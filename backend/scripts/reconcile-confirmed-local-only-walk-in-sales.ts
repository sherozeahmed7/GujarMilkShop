import path from 'path';
import 'dotenv/config';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';

const MODE = process.argv[2] || '--dry-run';
const CANONICAL = '00000000-0000-4000-8000-000000000001';
const QUARANTINE = 'HISTORICAL_SALE_IDENTITY_UNRESOLVED_REVIEW_REQUIRED';
const dbPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'com.shero.tauri-app', 'pos.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const auditPath = path.join(process.cwd(), 'audits', 'quarantined-walk-in-sales-audit.json');
const manifestPath = path.join(process.cwd(), 'audits', 'confirmed-local-only-reconciliation-manifest.json');

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const payloadFrom = async (SyncQueueService: any, tx: any, entityType: string, row: any) => {
  const p = await SyncQueueService.enrichPayload(entityType, row, tx);
  return Object.fromEntries(Object.entries(p).map(([k,v]) => [snake(k),v]));
};
const cloudStats = async (client: any) => (await client.query(`SELECT
  (SELECT COUNT(*)::int FROM sales WHERE sale_type='walk_in') sales,
  (SELECT COALESCE(SUM(total_amount),0)::numeric FROM sales WHERE sale_type='walk_in') gross,
  (SELECT COALESCE(SUM(paid_amount),0)::numeric FROM sales WHERE sale_type='walk_in') paid,
  (SELECT COALESCE(SUM(remaining_balance),0)::numeric FROM sales WHERE sale_type='walk_in') remaining,
  (SELECT COUNT(*)::int FROM sale_items i JOIN sales s ON s.id=i.sale_uuid WHERE s.sale_type='walk_in') items,
  (SELECT COUNT(*)::int FROM payments p JOIN sales s ON s.id=p.sale_uuid WHERE s.sale_type='walk_in') payments,
  (SELECT COUNT(*)::int FROM returns r JOIN sales s ON s.id=r.sale_uuid WHERE s.sale_type='walk_in') returns
`)).rows[0];

async function claim(client: PoolClient, eventUuid: string) {
  return (await client.query(`INSERT INTO processed_event_keys(event_uuid) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_uuid`, [eventUuid])).rowCount === 1;
}

async function dryRun(prisma: any, SyncQueueService: any, ids: number[]) {
  const sales = await prisma.sale.findMany({ where:{id:{in:ids.slice(0,3)}}, include:{items:true,payments:true}, orderBy:{id:'asc'} });
  const client = await pool.connect();
  const before = await cloudStats(client);
  const samples:any[]=[];
  try {
    await client.query('BEGIN');
    for (const sale of sales) {
      const saleUuid = await SyncQueueService.getCloudMapping('Sale', sale.id, prisma);
      if (!saleUuid) throw new Error(`Missing stable Sale mapping ${sale.id}`);
      const exists = await client.query(`SELECT id FROM sales WHERE id=$1 OR (device_id=$2 AND local_id=$3)`, [saleUuid,SyncQueueService.getDeviceId(),sale.id]);
      if (exists.rowCount) throw new Error(`Sample Sale ${sale.id} already exists in Neon`);
      const eventUuid=crypto.randomUUID();
      if (!await claim(client,eventUuid)) throw new Error('First claim failed');
      await client.query(`INSERT INTO idempotency_log(event_uuid,device_id,entity_type,operation) VALUES($1,$2,'Sale','CREATE')`,[eventUuid,SyncQueueService.getDeviceId()]);
      const p=await payloadFrom(SyncQueueService,prisma,'Sale',sale);
      await client.query(`INSERT INTO sales(id,local_id,device_id,sale_type,customer_uuid,customer_name,customer_phone,total_amount,paid_amount,remaining_balance,status,token_number,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[saleUuid,sale.id,SyncQueueService.getDeviceId(),p.sale_type,CANONICAL,p.customer_name,p.customer_phone,p.total_amount,p.paid_amount,p.remaining_balance,p.status,p.token_number,p.created_at,p.updated_at]);
      await client.query(`INSERT INTO cloud_sync_events(event_uuid,device_id,entity_type,cloud_uuid,operation,payload) VALUES($1,$2,'Sale',$3,'CREATE',$4::jsonb)`,[eventUuid,SyncQueueService.getDeviceId(),saleUuid,JSON.stringify(p)]);
      for(const item of sale.items){const uuid=(await SyncQueueService.getCloudMapping('SaleItem',item.id,prisma)) || crypto.randomUUID();await client.query(`INSERT INTO sale_items(id,local_id,device_id,sale_uuid,item_name,quantity,unit_price,total_price,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[uuid,item.id,SyncQueueService.getDeviceId(),saleUuid,item.itemName,item.quantity,item.unitPrice,item.totalPrice,item.createdAt]);}
      for(const payment of sale.payments){const uuid=(await SyncQueueService.getCloudMapping('Payment',payment.id,prisma)) || crypto.randomUUID();await client.query(`INSERT INTO payments(id,local_id,device_id,sale_uuid,method,amount,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uuid,payment.id,SyncQueueService.getDeviceId(),saleUuid,payment.method,payment.amount,payment.status,payment.createdAt]);}
      const retry1=await claim(client,eventUuid),retry2=await claim(client,eventUuid);
      const inserted=await client.query(`SELECT customer_uuid::text,created_at,total_amount::text,paid_amount::text,(EXTRACT(EPOCH FROM created_at AT TIME ZONE 'UTC')*1000)::bigint::text created_at_epoch_ms FROM sales WHERE id=$1`,[saleUuid]);
      if(retry1||retry2||inserted.rows[0].customer_uuid!==CANONICAL||Number(inserted.rows[0].created_at_epoch_ms)!==sale.createdAt.getTime())throw new Error(`Dry-run invariant failed ${sale.id}: ${JSON.stringify({retry1,retry2,customer:inserted.rows[0].customer_uuid,cloudEpoch:inserted.rows[0].created_at_epoch_ms,localEpoch:sale.createdAt.getTime()})}`);
      samples.push({localId:sale.id,cloudUuid:saleUuid,items:sale.items.length,payments:sale.payments.length,retry1,retry2});
    }
    const during=await cloudStats(client);
    if(during.sales-before.sales!==3||during.items-before.items!==samples.reduce((s,x)=>s+x.items,0)||during.payments-before.payments!==3)throw new Error(`Dry-run count mismatch ${JSON.stringify({before,during})}`);
    await client.query('ROLLBACK');
  } catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;} finally{client.release();}
  const after=await cloudStats(pool);
  console.log(JSON.stringify({mode:'ROLLBACK_ONLY',sampleSize:samples.length,result:'PASS',samples,before,after,productionChanged:JSON.stringify(before)!==JSON.stringify(after)},null,2));
}

async function prepare(prisma:any,SyncQueueService:any,ids:number[]){
  const backupPath=path.join(path.dirname(dbPath),`pos-pre-local-only-create-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g,"''")}'`);
  const existing=await pool.query(`SELECT id::text FROM sales WHERE id=ANY($1::uuid[])`,[(await prisma.localToCloudMapping.findMany({where:{entityType:'Sale',localId:{in:ids}}})).map((m:any)=>m.cloudUuid)]);
  if(existing.rowCount)throw new Error(`Identity changed since classification; ${existing.rowCount} Sale UUIDs now exist`);
  const manifest:any={createdAt:new Date().toISOString(),backupPath,sales:[]};
  await prisma.$transaction(async(tx:any)=>{
    for(const id of ids){
      const sale=await tx.sale.findUniqueOrThrow({where:{id},include:{items:true,payments:true}});
      if(sale.customerId!==117)throw new Error(`Wrong local customer ${id}`);
      const old=await tx.syncQueue.findFirstOrThrow({where:{entityType:'Sale',localId:id,status:'FAILED',error:QUARANTINE}});
      const saleUuid=await SyncQueueService.enqueueCreate(tx,'Sale',sale.id,sale,1);
      const saleEvent=await tx.syncQueue.findFirstOrThrow({where:{entityType:'Sale',localId:id,operation:'CREATE',status:'PENDING'},orderBy:{createdAt:'desc'}});
      const itemEvents=[];for(const item of sale.items){const uuid=await SyncQueueService.enqueueCreate(tx,'SaleItem',item.id,item,2);const e=await tx.syncQueue.findFirstOrThrow({where:{entityType:'SaleItem',localId:item.id,operation:'CREATE',status:'PENDING'},orderBy:{createdAt:'desc'}});itemEvents.push({localId:item.id,cloudUuid:uuid,eventUuid:e.eventUuid});}
      const paymentEvents=[];for(const payment of sale.payments){const uuid=await SyncQueueService.enqueueCreate(tx,'Payment',payment.id,payment,2);const e=await tx.syncQueue.findFirstOrThrow({where:{entityType:'Payment',localId:payment.id,operation:'CREATE',status:'PENDING'},orderBy:{createdAt:'desc'}});paymentEvents.push({localId:payment.id,cloudUuid:uuid,eventUuid:e.eventUuid});}
      await tx.syncQueue.update({where:{eventUuid:old.eventUuid},data:{status:'SYNCED',error:`SUPERSEDED_BY_CONFIRMED_LOCAL_ONLY_CREATE:${saleEvent.eventUuid}`}});
      manifest.sales.push({localId:id,cloudUuid:saleUuid,eventUuid:saleEvent.eventUuid,itemEvents,paymentEvents,createdAt:sale.createdAt,totalAmount:sale.totalAmount,paidAmount:sale.paidAmount});
    }
  },{timeout:300_000});
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({mode:'PREPARED',backupPath,sales:manifest.sales.length,items:manifest.sales.reduce((s:any,x:any)=>s+x.itemEvents.length,0),payments:manifest.sales.reduce((s:any,x:any)=>s+x.paymentEvents.length,0),manifestPath},null,2));
}

async function processPrepared(prisma:any){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const eventIds=manifest.sales.flatMap((s:any)=>[s.eventUuid,...s.itemEvents.map((x:any)=>x.eventUuid),...s.paymentEvents.map((x:any)=>x.eventUuid)]);
  const before=await cloudStats(pool);
  const {syncBatch}=await import('../src/controllers/syncBatch.controller');
  for(const layer of [1,2]){
    const rows=await prisma.syncQueue.findMany({where:{eventUuid:{in:eventIds},status:'PENDING',layer},orderBy:{createdAt:'asc'}});
    for(let i=0;i<rows.length;i+=50){
      const chunk=rows.slice(i,i+50);let body:any;
      const req:any={body:{batchId:crypto.randomUUID(),payloads:chunk.map((e:any)=>({eventUuid:e.eventUuid,cloudUuid:e.cloudUuid,entityType:e.entityType,deviceId:e.deviceId,localId:e.localId,operation:e.operation,payload:e.payload}))}};
      const res:any={status(){return this;},json(x:any){body=x;return this;}};
      await syncBatch(req,res);
      for(const result of body.results){if(result.status!=='SYNCED')throw new Error(`Sync failed ${result.eventUuid}: ${result.error}`);await prisma.syncQueue.update({where:{eventUuid:result.eventUuid},data:{status:'SYNCED',error:null}});}
    }
  }
  const after=await cloudStats(pool);
  const ids=manifest.sales.map((s:any)=>s.cloudUuid);
  const verify=await pool.query(`SELECT id::text,local_id,customer_uuid::text,total_amount::text,paid_amount::text,created_at FROM sales WHERE id=ANY($1::uuid[])`,[ids]);
  const ambiguous=await prisma.syncQueue.count({where:{entityType:'Sale',status:'FAILED',error:QUARANTINE}});
  const localCustomers=await prisma.customer.count({where:{customerType:'walk_in'}});
  const cloudCustomers=(await pool.query(`SELECT COUNT(*)::int count FROM customers WHERE customer_type='walk_in'`)).rows[0].count;
  const failures=await prisma.syncQueue.count({where:{eventUuid:{in:eventIds},status:{not:'SYNCED'}}});
  const delta={sales:after.sales-before.sales,gross:Number(after.gross)-Number(before.gross),paid:Number(after.paid)-Number(before.paid),remaining:Number(after.remaining)-Number(before.remaining),items:after.items-before.items,payments:after.payments-before.payments,returns:after.returns-before.returns};
  const verifiedSales=Number(verify.rowCount || 0);
  console.log(JSON.stringify({mode:'PROCESSED',backupPath:manifest.backupPath,before,after,delta,verifiedSales,wrongCustomer:verify.rows.filter((r:any)=>r.customer_uuid!==CANONICAL).length,missingSales:41-verifiedSales,failedEvents:failures,ambiguousRemaining:ambiguous,localWalkInCustomers:localCustomers,cloudWalkInCustomers:cloudCustomers},null,2));
}

async function verifyPrepared(prisma:any){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const saleIds=manifest.sales.map((s:any)=>s.cloudUuid);
  const itemIds=manifest.sales.flatMap((s:any)=>s.itemEvents.map((x:any)=>x.cloudUuid));
  const paymentIds=manifest.sales.flatMap((s:any)=>s.paymentEvents.map((x:any)=>x.cloudUuid));
  const eventIds=manifest.sales.flatMap((s:any)=>[s.eventUuid,...s.itemEvents.map((x:any)=>x.eventUuid),...s.paymentEvents.map((x:any)=>x.eventUuid)]);
  const [stats,sales,items,payments,cloudEvents,processed]=await Promise.all([
    cloudStats(pool),
    pool.query(`SELECT id::text,local_id,customer_uuid::text,total_amount::text,paid_amount::text,remaining_balance::text,(EXTRACT(EPOCH FROM created_at AT TIME ZONE 'UTC')*1000)::bigint::text created_epoch FROM sales WHERE id=ANY($1::uuid[])`,[saleIds]),
    pool.query(`SELECT id::text,sale_uuid::text FROM sale_items WHERE id=ANY($1::uuid[])`,[itemIds]),
    pool.query(`SELECT id::text,sale_uuid::text FROM payments WHERE id=ANY($1::uuid[])`,[paymentIds]),
    pool.query(`SELECT event_uuid::text FROM cloud_sync_events WHERE event_uuid=ANY($1::uuid[])`,[eventIds]),
    pool.query(`SELECT event_uuid::text FROM processed_event_keys WHERE event_uuid=ANY($1::uuid[])`,[eventIds]),
  ]);
  const queues=await prisma.syncQueue.groupBy({by:['status'],where:{eventUuid:{in:eventIds}},_count:{_all:true}});
  const localMappings=await prisma.localToCloudMapping.findMany({where:{entityType:'Sale',localId:{in:manifest.sales.map((s:any)=>s.localId)}}});
  const ambiguous=await prisma.syncQueue.count({where:{entityType:'Sale',status:'FAILED',error:QUARANTINE}});
  const wrongCustomer=sales.rows.filter((r:any)=>r.customer_uuid!==CANONICAL).length;
  const nullCustomer=sales.rows.filter((r:any)=>r.customer_uuid==null).length;
  const timestampMismatch=sales.rows.filter((r:any)=>{const m=manifest.sales.find((x:any)=>x.cloudUuid===r.id);return !m||Number(r.created_epoch)!==new Date(m.createdAt).getTime();}).length;
  const financialMismatch=sales.rows.filter((r:any)=>{const m=manifest.sales.find((x:any)=>x.cloudUuid===r.id);return !m||Number(r.total_amount)!==Number(m.totalAmount)||Number(r.paid_amount)!==Number(m.paidAmount);}).length;
  const mappingMismatch=manifest.sales.filter((m:any)=>!localMappings.some((x:any)=>x.localId===m.localId&&x.cloudUuid===m.cloudUuid)).length;
  const itemParentMismatch=manifest.sales.reduce((count:number,m:any)=>count+m.itemEvents.filter((e:any)=>!items.rows.some((x:any)=>x.id===e.cloudUuid&&x.sale_uuid===m.cloudUuid)).length,0);
  const paymentParentMismatch=manifest.sales.reduce((count:number,m:any)=>count+m.paymentEvents.filter((e:any)=>!payments.rows.some((x:any)=>x.id===e.cloudUuid&&x.sale_uuid===m.cloudUuid)).length,0);
  const gross=manifest.sales.reduce((s:number,x:any)=>s+Number(x.totalAmount),0);
  const paid=manifest.sales.reduce((s:number,x:any)=>s+Number(x.paidAmount),0);
  console.log(JSON.stringify({mode:'VERIFIED',backupPath:manifest.backupPath,manifest:{sales:saleIds.length,items:itemIds.length,payments:paymentIds.length,gross,paid},found:{sales:sales.rowCount,items:items.rowCount,payments:payments.rowCount,cloudEvents:cloudEvents.rowCount,processedKeys:processed.rowCount},queueStatuses:queues,wrongCustomer,nullCustomer,timestampMismatch,financialMismatch,mappingMismatch,itemParentMismatch,paymentParentMismatch,ambiguousRemaining:ambiguous,currentCloudStats:stats},null,2));
}

async function main(){
  const audit=JSON.parse(fs.readFileSync(auditPath,'utf8'));
  const ids=audit.results.filter((r:any)=>r.classification==='CONFIRMED_LOCAL_ONLY').map((r:any)=>r.localSale.id);
  if(ids.length!==41)throw new Error(`Expected 41 classified local-only sales, got ${ids.length}`);
  const {prisma}=await import('../src/config/database');
  const {SyncQueueService}=await import('../src/services/syncQueue.service');
  try{if(MODE==='--dry-run')await dryRun(prisma,SyncQueueService,ids);else if(MODE==='--prepare')await prepare(prisma,SyncQueueService,ids);else if(MODE==='--process')await processPrepared(prisma);else if(MODE==='--verify')await verifyPrepared(prisma);else throw new Error(`Unknown mode ${MODE}`);}finally{await prisma.$disconnect();await pool.end();}
}
main().catch((e)=>{console.error(e);process.exitCode=1;});

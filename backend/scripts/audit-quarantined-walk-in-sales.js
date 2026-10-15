require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const REASON = 'HISTORICAL_SALE_IDENTITY_UNRESOLVED_REVIEW_REQUIRED';
const dbPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'com.shero.tauri-app', 'pos.db');
const sqlite = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const neon = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });

const n = (value) => Number(value || 0).toFixed(4);
const itemFingerprint = (items) => items.map((x) => `${String(x.itemName || x.item_name).toLowerCase()}|${n(x.quantity)}|${n(x.unitPrice ?? x.unit_price)}|${n(x.totalPrice ?? x.total_price)}`).sort().join(';');
const paymentFingerprint = (payments) => payments.map((x) => `${String(x.method).toLowerCase()}|${n(x.amount)}|${String(x.status).toLowerCase()}`).sort().join(';');

async function main() {
  const quarantined = await sqlite.syncQueue.findMany({
    where: { entityType: 'Sale', operation: 'UPDATE', status: 'FAILED', error: REASON },
    orderBy: { localId: 'asc' },
  });
  const localIds = quarantined.map((q) => q.localId);
  const sales = await sqlite.sale.findMany({
    where: { id: { in: localIds }, saleType: 'walk_in' },
    include: { items: true, payments: true }, orderBy: { id: 'asc' },
  });
  const mappings = await sqlite.localToCloudMapping.findMany({ where: { entityType: 'Sale', localId: { in: localIds } }, orderBy: { createdAt: 'asc' } });
  const queueHistory = await sqlite.syncQueue.findMany({ where: { entityType: 'Sale', localId: { in: localIds } }, orderBy: { createdAt: 'asc' } });
  const returns = await sqlite.$queryRawUnsafe(`SELECT * FROM "Return" WHERE saleId IN (${localIds.map(() => '?').join(',')})`, ...localIds);
  const movements = await sqlite.inventoryMovement.findMany({ where: { OR: localIds.map((id) => ({ reference: { startsWith: `sale-${id}-` } })) } });

  const input = sales.map((s) => ({ local_id:s.id, created_at:s.createdAt.toISOString(), total_amount:s.totalAmount, paid_amount:s.paidAmount, remaining_balance:s.remainingBalance, sale_type:s.saleType }));
  const candidateRows = await neon.query(`
    WITH l AS (SELECT * FROM json_to_recordset($1::json) AS x(local_id int,created_at timestamptz,total_amount numeric,paid_amount numeric,remaining_balance numeric,sale_type text))
    SELECT l.local_id query_local_id,s.id::text,s.device_id,s.local_id,s.sale_type,s.customer_uuid::text,s.total_amount::text,s.paid_amount::text,s.remaining_balance::text,s.status,s.token_number,s.created_at,s.updated_at,
           ABS(EXTRACT(EPOCH FROM (s.created_at-l.created_at)))::float8 timestamp_delta_seconds
    FROM l JOIN sales s ON s.sale_type=l.sale_type AND s.total_amount=l.total_amount AND s.paid_amount=l.paid_amount AND s.remaining_balance=l.remaining_balance
      AND ABS(EXTRACT(EPOCH FROM (s.created_at-l.created_at))) <= 86400
  `, [JSON.stringify(input)]);
  const candidateIds = [...new Set(candidateRows.rows.map((r) => r.id))];
  const cloudItems = candidateIds.length ? (await neon.query(`SELECT sale_uuid::text,item_name,quantity::text,unit_price::text,total_price::text FROM sale_items WHERE sale_uuid=ANY($1::uuid[])`, [candidateIds])).rows : [];
  const cloudPayments = candidateIds.length ? (await neon.query(`SELECT sale_uuid::text,method,amount::text,status FROM payments WHERE sale_uuid=ANY($1::uuid[])`, [candidateIds])).rows : [];

  const allMapUuids = [...new Set(mappings.map((m) => m.cloudUuid))];
  const uuidSales = allMapUuids.length ? (await neon.query(`SELECT id::text FROM sales WHERE id=ANY($1::uuid[])`, [allMapUuids])).rows : [];
  const existingUuidSet = new Set(uuidSales.map((r) => r.id));
  const pairs = mappings.map((m) => ({ device_id:m.deviceId, local_id:m.localId }));
  const sourceSales = pairs.length ? (await neon.query(`WITH p AS (SELECT * FROM json_to_recordset($1::json) AS x(device_id text,local_id int)) SELECT p.device_id,p.local_id,s.id::text FROM p JOIN sales s USING(device_id,local_id)`, [JSON.stringify(pairs)])).rows : [];
  const eventUuids = queueHistory.map((q) => q.eventUuid);
  const cloudEvents = eventUuids.length ? (await neon.query(`SELECT event_uuid::text,cloud_uuid::text,operation FROM cloud_sync_events WHERE event_uuid=ANY($1::uuid[])`, [eventUuids])).rows : [];
  const idem = eventUuids.length ? (await neon.query(`SELECT event_uuid::text FROM idempotency_log WHERE event_uuid=ANY($1::uuid[])`, [eventUuids])).rows : [];
  const processed = eventUuids.length ? (await neon.query(`SELECT event_uuid::text FROM processed_event_keys WHERE event_uuid=ANY($1::uuid[])`, [eventUuids])).rows : [];

  const results = sales.map((sale) => {
    const saleMappings = mappings.filter((m) => m.localId === sale.id);
    const saleQueues = queueHistory.filter((q) => q.localId === sale.id);
    const saleEventIds = new Set(saleQueues.map((q) => q.eventUuid));
    const eventEvidence = cloudEvents.filter((e) => saleEventIds.has(e.event_uuid));
    const uuidEvidence = saleMappings.filter((m) => existingUuidSet.has(m.cloudUuid));
    const sourceEvidence = sourceSales.filter((s) => saleMappings.some((m) => m.deviceId === s.device_id && m.localId === s.local_id));
    const localItemFp = itemFingerprint(sale.items);
    const localPaymentFp = paymentFingerprint(sale.payments);
    const candidates = candidateRows.rows.filter((r) => r.query_local_id === sale.id).map((c) => {
      const items = cloudItems.filter((x) => x.sale_uuid === c.id);
      const payments = cloudPayments.filter((x) => x.sale_uuid === c.id);
      return { ...c, itemFingerprintMatch:itemFingerprint(items) === localItemFp, paymentFingerprintMatch:paymentFingerprint(payments) === localPaymentFp, itemCount:items.length, paymentCount:payments.length };
    });
    const strong = candidates.filter((c) => c.itemFingerprintMatch && c.paymentFingerprintMatch && c.timestamp_delta_seconds <= 5);
    let classification = 'AMBIGUOUS', matchedNeonUuid = null, rationale = '';
    const directIds = [...new Set([...eventEvidence.map((e) => e.cloud_uuid), ...uuidEvidence.map((m) => m.cloudUuid), ...sourceEvidence.map((s) => s.id)])].filter(Boolean);
    if (directIds.length === 1) { classification='CONFIRMED_EXISTING'; matchedNeonUuid=directIds[0]; rationale='Unique UUID/source/sync-history identity'; }
    else if (directIds.length > 1) { rationale='Conflicting direct historical identities'; }
    else if (strong.length === 1) { classification='CONFIRMED_EXISTING'; matchedNeonUuid=strong[0].id; rationale='Unique <=5s timestamp + financial + item + payment fingerprint match'; }
    else if (strong.length > 1) { rationale='Multiple strong cloud fingerprint matches'; }
    else if (candidates.some((c) => c.itemFingerprintMatch && c.paymentFingerprintMatch)) { rationale='Fingerprint match exists but timestamp evidence is not strong enough'; }
    else if (candidates.length) { rationale='Financial/date candidates exist but dependent fingerprints differ or are incomplete'; }
    else { classification='CONFIRMED_LOCAL_ONLY'; rationale='No UUID, source, sync-history, financial/date, item, or payment match'; }
    const saleReturns = returns.filter((r) => r.saleId === sale.id);
    const saleMovements = movements.filter((m) => String(m.reference || '').startsWith(`sale-${sale.id}-`));
    return {
      localSale:{ id:sale.id,createdAt:sale.createdAt,updatedAt:sale.updatedAt,tokenNumber:sale.tokenNumber,totalAmount:sale.totalAmount,paidAmount:sale.paidAmount,remainingBalance:sale.remainingBalance,status:sale.status,customerId:sale.customerId,customerName:sale.customerName,customerPhone:sale.customerPhone,itemCount:sale.items.length,items:sale.items,paymentCount:sale.payments.length,payments:sale.payments,returns:saleReturns,inventoryMovements:saleMovements,shiftIds:[...new Set(saleMovements.map((m) => m.shiftId).filter((x) => x != null))],userIds:[...new Set(saleMovements.map((m) => m.userId).filter((x) => x != null))] },
      sync:{ currentEvent:saleQueues.find((q) => q.error === REASON),queueHistory:saleQueues,mappingHistory:saleMappings,cloudEvents:eventEvidence,idempotencyEventUuids:idem.filter((x) => saleEventIds.has(x.event_uuid)).map((x) => x.event_uuid),processedEventUuids:processed.filter((x) => saleEventIds.has(x.event_uuid)).map((x) => x.event_uuid) },
      fingerprint:{ items:localItemFp,payments:localPaymentFp },candidates,strongCandidateCount:strong.length,classification,matchedNeonUuid,rationale,
    };
  });
  const counts = results.reduce((a,r)=>{a[r.classification]=(a[r.classification]||0)+1;return a;},{});
  const output = { generatedAt:new Date().toISOString(),mode:'READ_ONLY',database:dbPath,totalQuarantined:quarantined.length,counts,results };
  const outDir = path.join(process.cwd(),'audits'); fs.mkdirSync(outDir,{recursive:true});
  const outPath = path.join(outDir,'quarantined-walk-in-sales-audit.json'); fs.writeFileSync(outPath,JSON.stringify(output,null,2));
  console.log(JSON.stringify({ outputPath:outPath,totalQuarantined:quarantined.length,counts,cloudCandidates:candidateRows.rows.length },null,2));
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(async()=>{await sqlite.$disconnect();await neon.end();});

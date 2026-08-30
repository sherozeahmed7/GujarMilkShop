const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Users: ' + await prisma.user.count());
    console.log('Suppliers: ' + await prisma.supplier.count());
    console.log('Supplier Collections: ' + await prisma.supplierCollection.count());
    console.log('Supplier Payments: ' + await prisma.supplierPayment.count());
    console.log('Inventory Products: ' + await prisma.inventoryProduct.count());
    console.log('Inventory Movements: ' + await prisma.inventoryMovement.count());
    console.log('Shifts: ' + await prisma.shift.count());
    console.log('Daily Rates: ' + await prisma.dailyRate.count());
    console.log('Customers: ' + await prisma.customer.count());
    console.log('Sales: ' + await prisma.sale.count());
    console.log('Sale Items: ' + await prisma.saleItem.count());
    console.log('Payments: ' + await prisma.payment.count());
    console.log('Milk Product Daily Stocks: ' + await prisma.milkProductDailyStock.count());
    console.log('Milk Product Transactions: ' + await prisma.milkProductTransaction.count());
    console.log('Butter Ghee Conversions: ' + await prisma.butterGheeConversion.count());
    console.log('Expenses: ' + await prisma.expense.count());
    console.log('Expense Payments: ' + await prisma.expensePayment.count());
    console.log('Returns: ' + await prisma.return.count());
    console.log('Return Items: ' + await prisma.returnItem.count());
    console.log('Audit Records: ' + await prisma.auditRecord.count());

    const salesSum = await prisma.sale.aggregate({ _sum: { totalAmount: true, paidAmount: true } });
    console.log('Total Sales Amount: Rs. ' + salesSum._sum.totalAmount);
    console.log('Total Sales Paid: Rs. ' + salesSum._sum.paidAmount);

    const indPayments = await prisma.payment.aggregate({ _sum: { amount: true } });
    console.log('Total Independent Payments: Rs. ' + indPayments._sum.amount);

    const colls = await prisma.supplierCollection.aggregate({ _sum: { amount: true, quantity: true } });
    console.log('Supplier Collections Amount: Rs. ' + colls._sum.amount);
    console.log('Supplier Collections Quantity: ' + colls._sum.quantity + ' liters');
}

main().catch(console.error).finally(() => prisma.$disconnect());

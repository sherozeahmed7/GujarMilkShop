import { Router } from 'express';
import authRoutes from './auth.routes';
import productsRoutes from './products.routes';
import inventoryRoutes from './inventory.routes';
import salesRoutes from './sales.routes';
import customersRoutes from './customers.routes';
import khataRoutes from './khata.routes';
import suppliersRoutes from './suppliers.routes';
import milkPurchasesRoutes from './milkPurchases.routes';
import expensesRoutes from './expenses.routes';
import returnsRoutes from './returns.routes';
import paymentsRoutes from './payments.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/customers', customersRoutes);
router.use('/khata', khataRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/milkPurchases', milkPurchasesRoutes);
router.use('/expenses', expensesRoutes);
router.use('/returns', returnsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;

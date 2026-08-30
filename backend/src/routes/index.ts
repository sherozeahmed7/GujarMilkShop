import { Router } from 'express';
import connectionTestRoutes from './connectionTest.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import rateRoutes from './rate.routes';
import saleRoutes from './sale.routes';
import customerRoutes from './customer.routes';
import milkProductsRoutes from './milkProducts.routes';
import heldCartRoutes from './heldCart.routes';
import shiftRoutes from './shift.routes';
import supplierRoutes from './supplier.routes';
import inventoryRoutes from './inventory.routes';
import expenseRoutes from './expense.routes';
import returnRoutes from './return.routes';
import auditRoutes from './audit.routes';
import dashboardRoutes from './dashboard.routes';
import reportsRoutes from './reports.routes';
import neonRoutes from './neon.routes';
import syncRoutes from './sync.routes';

const router = Router();

router.get('/status', (req, res) => { res.json({ message: 'API routes are active!' }); });

router.use('/connection-test', connectionTestRoutes);
router.use('/auth',            authRoutes);
router.use('/users',           userRoutes);
router.use('/rates',           rateRoutes);
router.use('/sales',           saleRoutes);
router.use('/customers',       customerRoutes);
router.use('/milk-products',   milkProductsRoutes);
router.use('/held-carts',      heldCartRoutes);
router.use('/shifts',          shiftRoutes);
router.use('/suppliers',       supplierRoutes);
router.use('/inventory',       inventoryRoutes);
router.use('/expenses',        expenseRoutes);
router.use('/returns',         returnRoutes);
router.use('/audits',          auditRoutes);
router.use('/dashboard',       dashboardRoutes);
router.use('/reports',         reportsRoutes);
router.use('/neon',            neonRoutes);
router.use('/sync',            syncRoutes);

export default router;

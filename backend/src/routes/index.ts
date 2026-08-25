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

const router = Router();

// Basic verification endpoint
router.get('/status', (req, res) => {
  res.json({ message: 'API routes are active!' });
});

// Connection test route
router.use('/connection-test', connectionTestRoutes);

// Auth routes (POST /api/auth/login, POST /api/auth/logout)
router.use('/auth', authRoutes);

// User management routes (POST /api/users)
router.use('/users', userRoutes);

// Daily Rates routes (GET /api/rates, POST /api/rates)
router.use('/rates', rateRoutes);

// Sales routes (POST/GET /api/sales, settle)
router.use('/sales', saleRoutes);

// Customer (ledger) routes
router.use('/customers', customerRoutes);

// F2 Milk Products routes (stock, transactions, conversions)
router.use('/milk-products', milkProductsRoutes);

// Temporary POS bills (hold/resume)
router.use('/held-carts', heldCartRoutes);
router.use('/shifts', shiftRoutes);

export default router;

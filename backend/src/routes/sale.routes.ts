import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// POST /api/sales — Create sale (walk_in | split | ledger_*)
router.post('/', authenticateJWT, SaleController.createSale);

// GET /api/sales — List sales (filters: saleType, status, customerId, dateFrom, dateTo)
router.get('/', authenticateJWT, SaleController.listSales);

// GET /api/sales/:id — Single sale with items + payments
router.get('/:id', authenticateJWT, SaleController.getSale);

// POST /api/sales/:id/settle — Settle remaining due on a split sale
router.post('/:id/settle', authenticateJWT, SaleController.settleSale);

export default router;

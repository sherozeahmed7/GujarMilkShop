import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { ReportsController } from '../controllers/reports.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/expenses',       ReportsController.expenses);
router.get('/returns',        ReportsController.returns);
router.get('/shifts',         ReportsController.shifts);
router.get('/cash-register',  ReportsController.cashRegister);
router.get('/customers',      ReportsController.customers);
router.get('/suppliers',      ReportsController.suppliers);
router.get('/inventory',      ReportsController.inventory);
router.get('/profit-loss',    ReportsController.profitLoss);
router.get('/f2-sales',       ReportsController.f2Sales);

export default router;

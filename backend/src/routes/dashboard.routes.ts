import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/metrics',        DashboardController.getMetrics);
router.get('/recent-sales',   DashboardController.getRecentSales);
router.get('/khata-customers',DashboardController.getKhataCustomers);
router.get('/revenue-trend',  DashboardController.getRevenueTrend);

export default router;

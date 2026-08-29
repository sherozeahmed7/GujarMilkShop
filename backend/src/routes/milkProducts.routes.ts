import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import {
  getDailyStock,
  addMilk,
  addLassiProduction,
  addButterProduction,
  addGheeProduction,
  addConversion,
  setDayEndLassi,
  discardExpired,
  getTransactions,
  getConversions,
  addTransaction,
} from '../controllers/milkProducts.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/stock', getDailyStock);
router.get('/transactions', getTransactions);
router.get('/conversions', getConversions);

router.post('/stock/milk', addMilk);
router.post('/stock/lassi-production', addLassiProduction);
router.post('/stock/butter-production', addButterProduction);
router.post('/stock/ghee-production', addGheeProduction);
router.post('/stock/conversion', addConversion);
router.post('/stock/day-end-lassi', setDayEndLassi);
router.post('/stock/discard-expired', discardExpired);
router.post('/transactions', addTransaction);

export default router;

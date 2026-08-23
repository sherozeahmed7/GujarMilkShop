import { Router } from 'express';
import { RateController } from '../controllers/rate.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// GET /api/rates -> Fetch all price history and current rates (Protected by JWT middleware)
router.get('/', authenticateJWT, RateController.getRates);

// GET /api/rates/standard-prices -> Returns dynamically calculated box prices based on latest DB rates (Protected by JWT middleware)
router.get('/standard-prices', authenticateJWT, RateController.getStandardPrices);

// POST /api/rates -> Add a new price entry (any authenticated role)
router.post('/', authenticateJWT, RateController.createRate);

export default router;

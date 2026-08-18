import { Router } from 'express';
import { ConnectionTestController } from '../controllers/connectionTest.controller';

const router = Router();

// Route for testing connection
router.get('/', ConnectionTestController.check);

export default router;

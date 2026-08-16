import { Router } from 'express';
import { CustomersController } from '../controllers/customers.controller';

const router = Router();

router.get('/', CustomersController.get);

export default router;

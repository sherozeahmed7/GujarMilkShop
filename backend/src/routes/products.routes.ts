import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';

const router = Router();

router.get('/', ProductsController.get);

export default router;

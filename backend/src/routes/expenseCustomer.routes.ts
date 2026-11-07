import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { ExpenseCustomerController } from '../controllers/expenseCustomer.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/', ExpenseCustomerController.list);
router.post('/', ExpenseCustomerController.create);
router.put('/:id', ExpenseCustomerController.update);
router.delete('/:id', ExpenseCustomerController.remove);

export default router;


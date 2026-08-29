import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { ExpenseController } from '../controllers/expense.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/summary',   ExpenseController.summary);
router.get('/breakdown', ExpenseController.breakdown);
router.get('/',          ExpenseController.list);
router.get('/:id',       ExpenseController.getOne);
router.post('/',         ExpenseController.create);
router.post('/:id/pay',  ExpenseController.pay);
router.put('/:id',       ExpenseController.update);
router.delete('/:id',    ExpenseController.remove);

export default router;

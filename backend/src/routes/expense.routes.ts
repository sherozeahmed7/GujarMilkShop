import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { ExpenseController } from '../controllers/expense.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/summary',   ExpenseController.summary);
router.get('/breakdown', ExpenseController.breakdown);
router.get('/',          ExpenseController.list);
router.post('/personal/receive', ExpenseController.personalReceive);
router.get('/:id',       ExpenseController.getOne);
router.post('/',         ExpenseController.create);
router.post('/:id/pay',             ExpenseController.pay);
router.post('/:id/personal-receive', ExpenseController.personalReceiveForExpense);
router.post('/:id/personal-return',  ExpenseController.personalReturnForExpense);
router.put('/:id',       ExpenseController.update);
router.delete('/:id',    ExpenseController.remove);

export default router;

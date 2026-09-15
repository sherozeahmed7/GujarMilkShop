import { Router } from 'express';
import { CashbookController } from '../controllers/cashbook.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Protect all cashbook endpoints with JWT
router.use(authenticateJWT);

// Summary
router.get('/summary', CashbookController.getSummary);

// Persons
router.get('/persons', CashbookController.getCashPersons);
router.post('/persons', CashbookController.createCashPerson);
router.get('/persons/:id', CashbookController.getCashPersonById);
router.put('/persons/:id', CashbookController.updateCashPerson);
router.patch('/persons/:id/status', CashbookController.toggleStatus);
router.get('/persons/:id/ledger', CashbookController.getCashPersonLedger);

// Transactions
router.get('/transactions', CashbookController.getTransactions);
router.post('/transactions', CashbookController.addTransaction);

export default router;

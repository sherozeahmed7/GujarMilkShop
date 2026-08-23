import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// POST /api/customers — Create ledger customer
router.post('/', authenticateJWT, CustomerController.createCustomer);

// GET /api/customers — List customers
router.get('/', authenticateJWT, CustomerController.listCustomers);

// GET /api/customers/summary — Dashboard stats (must be before /:id)
router.get('/summary', authenticateJWT, CustomerController.getSummary);

// GET /api/customers/:id/dues — Pending/partial sales for customer
// (must be registered BEFORE /:id so "dues" is not treated as an id)
router.get('/:id/dues', authenticateJWT, CustomerController.getDues);

// POST /api/customers/:id/settle-all — Clear ALL dues for customer
router.post('/:id/settle-all', authenticateJWT, CustomerController.settleAll);

// PATCH /api/customers/:id/status — Activate / deactivate
router.patch('/:id/status', authenticateJWT, CustomerController.updateStatus);

// GET /api/customers/:id — Single customer
router.get('/:id', authenticateJWT, CustomerController.getCustomer);

// PUT /api/customers/:id — Update customer info
router.put('/:id', authenticateJWT, CustomerController.updateCustomer);

// DELETE /api/customers/:id — Soft delete (set inactive)
router.delete('/:id', authenticateJWT, CustomerController.deleteCustomer);

export default router;

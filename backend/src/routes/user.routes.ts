import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// POST /api/users -> Creates a new user (Protected by JWT middleware)
router.post('/', authenticateJWT, UserController.createUser);

// GET /api/users/roles -> Fetch all distinct roles (Protected by JWT middleware)
router.get('/roles', authenticateJWT, UserController.getRoles);

// GET /api/users -> Fetch all users with optional filtering (Protected by JWT middleware)
router.get('/', authenticateJWT, UserController.getUsers);

// PATCH /api/users/change-password -> Change a user's password (Protected by JWT middleware, requires super_admin)
router.patch('/change-password', authenticateJWT, UserController.changePassword);

// PATCH /api/users/admin-reset-password -> Super admin resets another user's password using admin's own password
router.patch('/admin-reset-password', authenticateJWT, UserController.adminResetPassword);

// DELETE /api/users/:id -> Deletes a user (Protected by JWT middleware)
router.delete('/:id', authenticateJWT, UserController.deleteUser);

// PUT /api/users/:id -> Updates a user (Protected by JWT middleware, requires super_admin)
router.put('/:id', authenticateJWT, UserController.updateUser);

// PATCH /api/users/:id/status -> Updates a user's status (Protected by JWT middleware, requires super_admin)
router.patch('/:id/status', authenticateJWT, UserController.updateUserStatus);

export default router;

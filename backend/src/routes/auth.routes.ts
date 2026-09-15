import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// GET /api/auth/login-users -> Active users for login avatar picker (no passwords)
router.get('/login-users', AuthController.listLoginUsers);

// POST /api/auth/login -> Handles user authentication
router.post('/login', AuthController.login);

// POST /api/auth/logout -> Protected route to process user logout
router.post('/logout', authenticateJWT, AuthController.logout);

export default router;


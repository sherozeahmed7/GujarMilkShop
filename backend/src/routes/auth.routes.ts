import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/login -> Handles user authentication
router.post('/login', AuthController.login);

// POST /api/auth/logout -> Protected route to process user logout
router.post('/logout', authenticateJWT, AuthController.logout);

export default router;


import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// POST /api/users -> Creates a new user (Protected by JWT middleware)
router.post('/', authenticateJWT, UserController.createUser);

export default router;

import { Router } from 'express';
import connectionTestRoutes from './connectionTest.routes';

const router = Router();

// Basic verification endpoint
router.get('/status', (req, res) => {
  res.json({ message: 'API routes are active!' });
});

// Connection test route
router.use('/connection-test', connectionTestRoutes);

export default router;

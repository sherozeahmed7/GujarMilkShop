import { Router, Request, Response, NextFunction } from 'express';
import { queryWithRetry, getNeonPool } from '../config/neonDb';
import { comparePassword, generateAccessToken } from '../utils/auth';
import { ApiResponse } from '../utils/apiResponse';
import { loginLimiter, authenticateCloudJWT, CloudAuthRequest } from './cloudAuth.middleware';

const router = Router();

// GET /api/auth/login-users - list active users in Neon
router.get('/login-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry(
      "SELECT id, name, email, role FROM users WHERE LOWER(status) = 'active' ORDER BY role ASC, name ASC"
    );
    const users = result.rows.map((u: any) => ({
      id: u.id,
      name: u.name || u.email.split('@')[0],
      email: u.email,
      role: u.role,
    }));
    return ApiResponse.success(res, 'Login users fetched successfully', users, 200);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - cloud portal login with rate limiter
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return ApiResponse.error(res, 'Email and password are required', 400);
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const result = await queryWithRetry(
      'SELECT id, name, email, password, role, status, assigned_screens FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return ApiResponse.error(res, 'Invalid email or password', 401);
    }

    const user = result.rows[0];

    // Password verification
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return ApiResponse.error(res, 'Invalid email or password', 401);
    }

    if (user.status && user.status.toLowerCase() !== 'active') {
      return ApiResponse.error(res, 'Your account is inactive. Please contact admin.', 403);
    }

    // All 30 canonical screens - super_admin and admin always get full access
    const ALL_CANONICAL_SCREENS = [
      'Dashboard', 'Point of Sale', 'Inventory', 'Suppliers', 'Customers',
      'Khata / Ledger', 'Returns', 'Receipt Audit', 'Shifts', 'Cash Register',
      'Cashbook', 'Expenses', 'Reports', 'Sales Report', 'F2 Sales Report',
      'Supplier Report', 'Customer Report', 'Inventory Report', 'Returns Report',
      'Cash Register Report', 'Shifts Report', 'Expenses Report', 'Backup Report',
      'Profit & Loss', 'Activity Logs', 'Daily Rates', 'Settings', 'Shop Info',
      'POS Config', 'Users & Roles', 'Cloud & Sync', 'Local Backup'
    ];

    let assignedScreens: string[] = [];
    const isAdminRole = ['super_admin', 'admin'].includes((user.role || '').toLowerCase());
    if (isAdminRole) {
      // Admins always get all screens so they can assign any screen to new users
      assignedScreens = ALL_CANONICAL_SCREENS;
    } else {
      try {
        assignedScreens = typeof user.assigned_screens === 'string'
          ? JSON.parse(user.assigned_screens)
          : (Array.isArray(user.assigned_screens) ? user.assigned_screens : []);
      } catch {
        assignedScreens = [];
      }
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return ApiResponse.success(res, 'Login successful', {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedScreens,
      },
    }, 200);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  return ApiResponse.success(res, 'Logged out successfully', null, 200);
});

// GET /api/auth/me - returns current authenticated cloud user
router.get('/me', authenticateCloudJWT, (req: CloudAuthRequest, res: Response) => {
  return ApiResponse.success(res, 'User profile fetched', req.user, 200);
});

export default router;

import express from 'express';
import rateLimit from 'express-rate-limit';
import { queryWithRetry } from '../config/neonDb';
import { verifyAccessToken, JwtPayload } from '../utils/auth';
import { ApiResponse } from '../utils/apiResponse';
import { SUPER_ADMIN_ROLE } from '../config/constants';

// Rate limiter for auth endpoints
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 mins per IP
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export interface CloudAuthRequest extends express.Request {
  user?: JwtPayload & { assignedScreens?: string[] };
}

// Cloud JWT authentication middleware
export const authenticateCloudJWT = async (
  req: CloudAuthRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Access denied. No authorization token provided.', 401);
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return ApiResponse.error(res, 'Access denied. Token missing.', 401);
    }

    const decoded = verifyAccessToken(token);
    // Verify user is active in Neon
    const userRes = await queryWithRetry(
      'SELECT id, email, role, status, assigned_screens FROM users WHERE LOWER(email) = LOWER($1)',
      [decoded.email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      return ApiResponse.error(res, 'User not found in cloud registry.', 401);
    }

    const dbUser = userRes.rows[0];
    if (dbUser.status && dbUser.status.toLowerCase() !== 'active') {
      return ApiResponse.error(res, 'Account is inactive.', 403);
    }

    let screens: string[] = [];
    try {
      screens = typeof dbUser.assigned_screens === 'string'
        ? JSON.parse(dbUser.assigned_screens)
        : (Array.isArray(dbUser.assigned_screens) ? dbUser.assigned_screens : []);
    } catch {
      screens = [];
    }

    req.user = {
      ...decoded,
      role: dbUser.role,
      assignedScreens: screens,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Authorization token expired. Please log in again.', 401);
    }
    return ApiResponse.error(res, 'Invalid authorization token.', 401);
  }
};

// RBAC middleware factory for cloud routes
export const requireCloudScreen = (screenName: string) => {
  return (req: CloudAuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required.', 401);
    }
    if (req.user.role === SUPER_ADMIN_ROLE) {
      return next();
    }
    const screens = req.user.assignedScreens || [];
    if (screens.includes(screenName)) {
      return next();
    }
    return ApiResponse.error(res, `Forbidden: Insufficient privileges for screen '${screenName}'.`, 403);
  };
};

export const requireCloudSuperAdmin = (req: CloudAuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== SUPER_ADMIN_ROLE) {
    return ApiResponse.error(res, 'Forbidden: Only super_admin can perform this action.', 403);
  }
  next();
};

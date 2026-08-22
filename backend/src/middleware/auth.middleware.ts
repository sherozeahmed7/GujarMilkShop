import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/auth';
import { ApiResponse } from '../utils/apiResponse';
import { SUPER_ADMIN_ROLE } from '../config/constants';

/**
 * Custom Express Request interface extending standard Request to include authenticated user data.
 */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Generic Authentication Middleware
 * 
 * Protects backend routes by checking for a valid JWT access token in the Authorization header.
 * Header Format Expected: "Authorization: Bearer <token>"
 */
export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract Authorization header from incoming request
    const authHeader = req.headers.authorization;

    // Check if Authorization header is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(
        res,
        'Access denied. No authorization token provided.',
        401
      );
    }

    // Extract the token string after 'Bearer '
    const token = authHeader.split(' ')[1];

    if (!token) {
      return ApiResponse.error(
        res,
        'Access denied. Token missing from authorization header.',
        401
      );
    }

    // Verify token validity and expiration (1h limit)
    const decodedUser = verifyAccessToken(token);

    // Attach decoded user information (userId, email, role) to request object
    req.user = decodedUser;

    // Proceed to next middleware or route handler
    next();
  } catch (error: any) {
    // Handle specific JWT expiration or invalid token errors
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Authorization token has expired. Please log in again.', 401);
    }
    
    return ApiResponse.error(res, 'Invalid authorization token.', 401);
  }
};

/**
 * Utility function to check if the authenticated user is a super_admin.
 * Returns true if super_admin, false otherwise.
 */
export const isSuperAdmin = (req: AuthenticatedRequest): boolean => {
  return req.user?.role === SUPER_ADMIN_ROLE;
};

/**
 * Role-based Authorization Middleware
 * 
 * Ensures the authenticated user has the 'super_admin' role.
 * Must be used AFTER authenticateJWT middleware.
 */
export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!isSuperAdmin(req)) {
    return ApiResponse.error(
      res,
      'Forbidden: Only super_admin can perform this action.',
      403
    );
  }
  next();
};

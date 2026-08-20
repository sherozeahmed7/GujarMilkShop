import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AuthController {
  /**
   * Handles POST /api/auth/login request.
   * Validates required input fields and delegates verification to AuthService.
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      // 1. Input Validation: check if email or password are missing
      if (!email || !password) {
        return ApiResponse.error(res, 'Email and password are required', 400);
      }

      // 2. Delegate authentication check to service layer
      const result = await AuthService.login(email, password);

      // 3. Handle authentication failures (e.g. invalid credentials)
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 401);
      }

      // 4. Return successful response with JWT token, role, and assigned screens
      return ApiResponse.success(res, 'Login successful', result.data, 200);
    } catch (error) {
      // Pass any unexpected runtime errors to global errorHandler
      next(error);
    }
  }

  /**
   * Handles POST /api/auth/logout request.
   * Requires JWT authentication token via authenticateJWT middleware.
   */
  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      // Call AuthService to handle logout processing
      const result = await AuthService.logout(userId || 0);

      return ApiResponse.success(res, result.message, null, 200);
    } catch (error) {
      next(error);
    }
  }
}


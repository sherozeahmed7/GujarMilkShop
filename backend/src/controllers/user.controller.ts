import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class UserController {
  /**
   * Handles POST /api/users request to create a new user.
   * Accepts email, password, assignedRole, and assignedScreens array.
   */
  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, password, assignedRole, role, assignedScreens } = req.body;

      // 1. Determine email (handle cases where frontend sends email or name as primary identifier)
      const userEmail = email || (name && name.includes('@') ? name : null);

      if (!userEmail || !password) {
        return ApiResponse.error(
          res,
          'Email and password are required fields.',
          400
        );
      }

      // 2. Validate email format using regex
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim());
      if (!isValidEmail) {
        return ApiResponse.error(res, 'Please provide a valid email address.', 400);
      }

      // 3. Delegate creation logic to UserService
      const result = await UserService.createUser({
        name,
        email: userEmail,
        password,
        assignedRole,
        role,
        assignedScreens
      });

      // 4. Handle creation failure (e.g. duplicate email)
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 400);
      }

      // 5. Return 201 Created response
      return ApiResponse.success(
        res,
        'User created successfully',
        result.data,
        201
      );
    } catch (error) {
      next(error);
    }
  }
}

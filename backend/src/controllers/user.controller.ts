import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest, isSuperAdmin } from '../middleware/auth.middleware';
import { ALL_SCREENS } from '../config/database';

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
        return ApiResponse.error(res, 'Email and password are required fields.', 400);
      }

      // 2. Validate email format using regex
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim());
      if (!isValidEmail) {
        return ApiResponse.error(res, 'Please provide a valid email address.', 400);
      }

      // 3. Validate assignedRole is provided
      if (!assignedRole || !assignedRole.trim()) {
        return ApiResponse.error(res, 'Assigned role is required.', 400);
      }

      // 4. Validate assignedScreens contains at least one valid screen
      const validScreens = ALL_SCREENS;

      if (!assignedScreens || !Array.isArray(assignedScreens) || assignedScreens.length === 0) {
        return ApiResponse.error(res, 'At least one assigned screen is required.', 400);
      }

      // Check that at least one screen in the array is a valid screen name
      const hasValidScreen = assignedScreens.some((screen: string) => validScreens.includes(screen));
      if (!hasValidScreen) {
        return ApiResponse.error(res, 'Assigned screens must contain at least one valid screen name.', 400);
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

  /**
   * Handles GET /api/users to fetch all users with optional filtering.
   */
  static async getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, email, status, role } = req.query;

      const result = await UserService.getUsers({
        name: name as string,
        email: email as string,
        status: status as string,
        role: role as string
      });

      return ApiResponse.success(res, 'Users fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles DELETE /api/users/:id to remove a user.
   */
  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || isNaN(Number(id))) {
        return ApiResponse.error(res, 'Valid user ID is required.', 400);
      }

      // Check if requester is super_admin
      if (!isSuperAdmin(req)) {
        return ApiResponse.error(res, 'Forbidden: Only super_admin can perform this action.', 403);
      }

      // Self-edit protection: Prevent deleting yourself
      if (req.user?.userId === Number(id)) {
        return ApiResponse.error(res, 'Forbidden: You cannot delete your own account.', 403);
      }

      const result = await UserService.deleteUser(Number(id));

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 400);
      }

      return ApiResponse.success(res, result.message!, null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles PUT /api/users/:id to update a user.
   * Requires super_admin role.
   */
  static async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || isNaN(Number(id))) {
        return ApiResponse.error(res, 'Valid user ID is required.', 400);
      }

      // Check if requester is super_admin
      if (!isSuperAdmin(req)) {
        return ApiResponse.error(res, 'Forbidden: Only super_admin can perform this action.', 403);
      }

      const { name, email, role, assignedScreens, password } = req.body;

      if (!email || !role) {
        return ApiResponse.error(res, 'Email and role are required fields.', 400);
      }

      // Self-edit protection: Prevent changing your own role
      if (req.user?.userId === Number(id) && role !== req.user.role) {
        return ApiResponse.error(res, 'Forbidden: You cannot change your own role.', 403);
      }

      // Validate email format
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      if (!isValidEmail) {
        return ApiResponse.error(res, 'Please provide a valid email address.', 400);
      }

      // Validate assignedScreens contains at least one valid screen
      const validScreens = ALL_SCREENS;

      if (!assignedScreens || !Array.isArray(assignedScreens) || assignedScreens.length === 0) {
        return ApiResponse.error(res, 'At least one assigned screen is required.', 400);
      }

      const hasValidScreen = assignedScreens.some((screen: string) => validScreens.includes(screen));
      if (!hasValidScreen) {
        return ApiResponse.error(res, 'Assigned screens must contain at least one valid screen name.', 400);
      }

      const result = await UserService.updateUser(Number(id), {
        name,
        email,
        role,
        assignedScreens,
        password: typeof password === 'string' && password.trim() ? password.trim() : undefined,
      });

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 400);
      }

      return ApiResponse.success(res, 'User updated successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles GET /api/users/roles to fetch all distinct roles
   */
  static async getRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await UserService.getRoles();
      return ApiResponse.success(res, 'Roles fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles PATCH /api/users/:id/status to update a user's status
   * Requires super_admin role.
   */
  static async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || isNaN(Number(id))) {
        return ApiResponse.error(res, 'Valid user ID is required.', 400);
      }

      if (!status || !['active', 'inactive'].includes(status.toLowerCase())) {
        return ApiResponse.error(res, 'Status must be either "active" or "inactive".', 400);
      }

      // Check if requester is super_admin
      if (!isSuperAdmin(req)) {
        return ApiResponse.error(res, 'Forbidden: Only super_admin can perform this action.', 403);
      }

      // Self-edit protection: Prevent changing your own status
      if (req.user?.userId === Number(id)) {
        return ApiResponse.error(res, 'Forbidden: You cannot change your own status.', 403);
      }

      const result = await UserService.updateUserStatus(Number(id), status.toLowerCase());

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 400);
      }

      return ApiResponse.success(res, result.message!, result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles PATCH /api/users/change-password to update a user's password
   * Requires super_admin role.
   */
  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId, currentPassword, newPassword } = req.body;

      if (!userId || isNaN(Number(userId))) {
        return ApiResponse.error(res, 'Valid user ID is required.', 400);
      }

      if (!currentPassword || !newPassword) {
        return ApiResponse.error(res, 'Both current password and new password are required.', 400);
      }

      // Check if requester is super_admin
      if (!isSuperAdmin(req)) {
        return ApiResponse.error(res, 'Forbidden: Only super_admin can perform this action.', 403);
      }

      const result = await UserService.changeUserPassword(Number(userId), currentPassword, newPassword);

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 400);
      }

      return ApiResponse.success(res, result.message!, null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles PATCH /api/users/admin-reset-password
   * Super Admin resets a user's password by providing their own admin password.
   */
  static async adminResetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId, adminPassword, newPassword } = req.body;

      if (!userId || isNaN(Number(userId))) {
        return ApiResponse.error(res, 'Valid target user ID is required.', 400);
      }

      if (!adminPassword || !newPassword) {
        return ApiResponse.error(res, 'Both admin password and new password are required.', 400);
      }

      // Check if requester is super_admin
      if (!isSuperAdmin(req)) {
        return ApiResponse.error(res, 'Forbidden: Only super_admin can perform this action.', 403);
      }

      const adminId = req.user!.userId; // Guaranteed by authenticateJWT

      const result = await UserService.adminResetUserPassword(adminId, adminPassword, Number(userId), newPassword);

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 400);
      }

      return ApiResponse.success(res, result.message!, null, 200);
    } catch (error) {
      next(error);
    }
  }
}

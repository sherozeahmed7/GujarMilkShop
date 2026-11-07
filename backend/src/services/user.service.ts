import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { hashPassword, comparePassword } from '../utils/auth';

export interface CreateUserPayload {
  name?: string;
  email: string;
  password: string;
  assignedRole?: string;
  role?: string;
  assignedScreens?: string[];
}

export class UserService {
  /**
   * Registers/Creates a new user in the database with hashed password and assigned screens.
   * @param payload User creation payload containing name, email, password, role, and screens
   */
  static async createUser(payload: CreateUserPayload) {
    const { name, email, password, assignedRole, role, assignedScreens } = payload;

    // 1. Check if a user with the given email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return {
        success: false,
        statusCode: 400,
        message: 'A user with this email address already exists.'
      };
    }

    // 2. Hash the user password securely using bcrypt (10 rounds)
    const hashedPassword = await hashPassword(password);

    // 3. Determine the user role (accepts assignedRole or role)
    const userRole = assignedRole || role || 'user';

    // 4. Stringify assigned screens array for SQLite storage
    const screensJson = JSON.stringify(assignedScreens || []);

    // 5. Save the new user record into the database with status defaulting to 'active'
    const newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: (name && name.trim()) ? name.trim() : email.split('@')[0],
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: userRole,
          status: 'active',
          assignedScreens: screensJson
        }
      });
      await SyncQueueService.enqueueCreate(tx, 'User', created.id, created, 0);
      return created;
    });

    // 6. Parse assignedScreens JSON back into an array for the response
    let parsedScreens: string[] = [];
    try {
      parsedScreens = JSON.parse(newUser.assignedScreens || '[]');
    } catch {
      parsedScreens = [];
    }

    // 7. Return created user object (excluding hashed password)
    return {
      success: true,
      statusCode: 201,
      data: {
        id: newUser.id,
        name: newUser.name || null,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        assignedScreens: parsedScreens,
        createdAt: newUser.createdAt
      }
    };
  }

  /**
   * Retrieves all users with optional filtering
   */
  static async getUsers(filters: { name?: string; email?: string; status?: string; role?: string }) {
    const whereClause: any = {};
    if (filters.name) whereClause.name = { equals: filters.name };
    if (filters.email) whereClause.email = { equals: filters.email };
    if (filters.role) whereClause.role = { equals: filters.role };
    
    // If status is provided and not an empty string, convert to lowercase to match DB
    if (filters.status && filters.status.trim() !== '') {
      whereClause.status = { equals: filters.status.toLowerCase().trim() };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        assignedScreens: true,
        createdAt: true
      }
    });

    const formattedUsers = users.map(user => {
      let parsedScreens: string[] = [];
      try {
        parsedScreens = JSON.parse(user.assignedScreens || '[]');
      } catch {
        parsedScreens = [];
      }
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        assignedScreensCount: parsedScreens.length,
        assignedScreens: parsedScreens,
        createdAt: user.createdAt
      };
    });

    return {
      success: true,
      statusCode: 200,
      data: formattedUsers
    };
  }

  /**
   * Updates an existing user
   */
  static async updateUser(id: number, payload: { name?: string; email: string; role: string; assignedScreens: string[]; password?: string }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, statusCode: 404, message: 'User not found.' };
    }

    if (payload.email.toLowerCase().trim() !== user.email) {
       const existingUser = await prisma.user.findUnique({
        where: { email: payload.email.toLowerCase().trim() }
      });
      if (existingUser) {
        return { success: false, statusCode: 400, message: 'Email is already in use by another user.' };
      }
    }

    const updateData: any = {
      name: (payload.name && payload.name.trim()) ? payload.name.trim() : user.name,
      email: payload.email.toLowerCase().trim(),
      role: payload.role,
      assignedScreens: JSON.stringify(payload.assignedScreens || [])
    };

    if (payload.password && payload.password.trim() !== '') {
      updateData.password = await hashPassword(payload.password.trim());
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData
      });
      await SyncQueueService.enqueueUpdate(tx, 'User', updated.id, updated, 0);
      return updated;
    });

    let parsedScreens: string[] = [];
    try {
      parsedScreens = JSON.parse(updatedUser.assignedScreens || '[]');
    } catch {
      parsedScreens = [];
    }

    return {
      success: true,
      statusCode: 200,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        assignedScreensCount: parsedScreens.length,
        assignedScreens: parsedScreens,
        createdAt: updatedUser.createdAt
      }
    };
  }

  /**
   * Deletes a user or deactivates if historical records exist
   */
  static async deleteUser(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, statusCode: 404, message: 'User not found.' };
    }

    // Check if user has historical business references
    const [
      openedShifts,
      closedShifts,
      supplierCollections,
      supplierPayments
    ] = await Promise.all([
      prisma.shift.count({ where: { openedById: id } }),
      prisma.shift.count({ where: { closedById: id } }),
      prisma.supplierCollection.count({ where: { createdById: id } }),
      prisma.supplierPayment.count({ where: { createdById: id } })
    ]);

    const hasDependencies = (openedShifts + closedShifts + supplierCollections + supplierPayments) > 0;

    if (hasDependencies) {
      // Soft-deactivate to preserve historical transaction audit integrity
      await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: { status: 'inactive' }
        });
        await SyncQueueService.enqueueUpdate(tx, 'User', id, updated, 0, 'UPDATE');
      });

      return {
        success: true,
        statusCode: 200,
        message: 'User has historical transactions. User has been deactivated instead of deleted.'
      };
    }

    // If no dependencies exist, permanently delete the user from database
    try {
      await prisma.$transaction(async (tx) => {
        const cloudUuid = await SyncQueueService.getCloudMapping('User', id, tx);
        if (cloudUuid) {
          await SyncQueueService.enqueueUpdate(tx, 'User', id, user, 0, 'DELETE');
        }
        await tx.user.delete({ where: { id } });
      });

      return {
        success: true,
        statusCode: 200,
        message: 'User deleted successfully.'
      };
    } catch (e: any) {
      return {
        success: false,
        statusCode: 400,
        message: 'Failed to delete user: ' + (e.message || e)
      };
    }
  }

  /**
   * Retrieves all distinct roles from the users table
   */
  static async getRoles() {
    const rolesResult = await prisma.user.findMany({
      select: { role: true },
      distinct: ['role']
    });

    const roles = rolesResult.map(r => r.role).filter(Boolean);

    return {
      success: true,
      statusCode: 200,
      data: roles
    };
  }

  /**
   * Updates a user's status
   */
  static async updateUserStatus(id: number, status: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return { success: false, statusCode: 404, message: 'User not found.' };
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status }
      });
      await SyncQueueService.enqueueUpdate(tx, 'User', updated.id, updated, 0);
      return updated;
    });

    return {
      success: true,
      statusCode: 200,
      message: 'User status updated successfully.',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status
      }
    };
  }

  /**
   * Changes a user's password
   */
  static async changeUserPassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, statusCode: 404, message: 'User not found.' };
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return { success: false, statusCode: 400, message: 'Current password is incorrect.' };
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });
      await SyncQueueService.enqueueUpdate(tx, 'User', updated.id, updated, 0);
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Password changed successfully.'
    };
  }

  /**
   * Admin changes a user's password using the admin's own password for verification
   */
  static async adminResetUserPassword(adminId: number, adminPassword: string, targetUserId: number, newPassword: string) {
    // 1. Verify admin password
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser) {
      return { success: false, statusCode: 404, message: 'Admin user not found.' };
    }

    const isAdminMatch = await comparePassword(adminPassword, adminUser.password);
    if (!isAdminMatch) {
      return { success: false, statusCode: 400, message: 'Super admin password is incorrect.' };
    }

    // 2. Check if target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return { success: false, statusCode: 404, message: 'Target user not found.' };
    }

    // 3. Update target user's password
    const hashedPassword = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { password: hashedPassword }
      });
      await SyncQueueService.enqueueUpdate(tx, 'User', updated.id, updated, 0);
    });

    return {
      success: true,
      statusCode: 200,
      message: 'User password reset successfully by admin.'
    };
  }
}

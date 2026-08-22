import { prisma } from '../config/database';
import { comparePassword, generateAccessToken } from '../utils/auth';

export class AuthService {
  /**
   * Validates user credentials and generates a JWT access token upon successful login.
   * @param email User's email address
   * @param password Plain-text candidate password
   * @returns Object containing JWT access token and user profile details
   */
  static async login(email: string, password: string) {
    const normalizedEmail = (email || '').toLowerCase().trim();

    // 1. Fetch user from database by unique email address
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // 2. Return error signal if user is not found
    if (!user) {
      return { success: false, statusCode: 401, message: 'Invalid email or password' };
    }

    // 3. Verify candidate password against hashed password stored in DB
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      return { success: false, statusCode: 401, message: 'Invalid email or password' };
    }

    // 4. Check user account status (must be active to log in)
    if (user.status && user.status.toLowerCase() !== 'active') {
      return {
        success: false,
        statusCode: 403,
        message: 'Your account is inactive. You are not allowed to login, please contact admin.'
      };
    }

    // 5. Parse assignedScreens JSON string back into a JavaScript array
    let assignedScreens: string[] = [];
    try {
      assignedScreens = JSON.parse(user.assignedScreens || '[]');
    } catch {
      assignedScreens = [];
    }

    // 6. Generate 1-hour JWT access token embedding userId, email, and role
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // 7. Return success result payload
    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name || null,
          email: user.email,
          role: user.role,
          status: user.status || 'active',
          assignedScreens
        }
      }
    };
  }

  /**
   * Handles user logout logic on the backend.
   * Acknowledges session termination for authenticated user.
   * @param userId Authenticated user ID
   */
  static async logout(userId: number) {
    // In stateless JWT authentication, logging out signals session completion.
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }
}


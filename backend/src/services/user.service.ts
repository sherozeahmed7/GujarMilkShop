import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';

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

    // 5. Save the new user record into the database
    const newUser = await prisma.user.create({
      data: {
        name: name ? name.trim() : null,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: userRole,
        assignedScreens: screensJson
      }
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
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        assignedScreens: parsedScreens,
        createdAt: newUser.createdAt
      }
    };
  }
}

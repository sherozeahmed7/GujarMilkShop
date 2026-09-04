import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Interface defining the data embedded inside the JWT payload
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

// Fetch secret key and expiry time from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Hashes a plain-text password using bcrypt with a salt round of 10.
 * @param password Plain-text password string
 * @returns Promise<string> Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compares a plain-text password against a stored hashed password.
 * @param password Plain-text candidate password
 * @param hash Stored hashed password
 * @returns Promise<boolean> True if match, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generates a signed JWT access token containing the user payload.
 * Lifetime is configured to 24h by default.
 * @param payload Object containing userId, email, and role
 * @returns Signed JWT string
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
}

/**
 * Verifies and decodes a given JWT access token.
 * Throws an error if token is expired, invalid, or tampered with.
 * @param token JWT string to verify
 * @returns Decoded JwtPayload
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

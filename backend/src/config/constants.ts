import dotenv from 'dotenv';
dotenv.config();

export const SUPER_ADMIN_ROLE = process.env.SUPER_ADMIN_ROLE || 'super_admin';

import { prisma } from '../db/client.js';
import bcrypt from 'bcryptjs';

export interface CreateAdminInput {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

export const adminService = {
  /**
   * Create a new admin user with hashed password
   */
  async createAdmin(data: CreateAdminInput) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    
    return prisma.adminUser.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: data.role || 'admin',
        mustChangePassword: true,
      },
    });
  },

  /**
   * Validate admin credentials and return admin if valid
   */
  async validateCredentials(email: string, password: string) {
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      return null;
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login time
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return admin;
  },

  /**
   * Change admin password
   */
  async changePassword(adminId: string, oldPassword: string, newPassword: string) {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const isValid = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    return prisma.adminUser.update({
      where: { id: adminId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });
  },

  /**
   * Force set password (for first-time setup without old password)
   */
  async setPassword(adminId: string, newPassword: string) {
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    return prisma.adminUser.update({
      where: { id: adminId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });
  },

  /**
   * Get admin by ID
   */
  async getAdmin(adminId: string) {
    return prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  },

  /**
   * Get admin by email
   */
  async getAdminByEmail(email: string) {
    return prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  },

  /**
   * List all admins
   */
  async listAdmins() {
    return prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Check if any admin exists (for initial setup)
   */
  async hasAnyAdmin() {
    const count = await prisma.adminUser.count();
    return count > 0;
  },
};
















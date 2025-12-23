/**
 * Auth Routes Tests
 */

import request from 'supertest';
import express from 'express';
import { authRoutes } from '../../src/routes/auth.js';
import { prisma } from '../setup.js';
import { adminService } from '../../src/services/adminService.js';
import jwt from 'jsonwebtoken';

// Create a test app with the auth routes
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.adminUser.deleteMany();
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      // Create a test admin user
      await adminService.createAdmin({
        email: 'test@example.com',
        password: 'TestPassword123',
        name: 'Test Admin',
        role: 'admin',
      });

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.role).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      await adminService.createAdmin({
        email: 'test@example.com',
        password: 'TestPassword123',
        name: 'Test Admin',
        role: 'admin',
      });

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        });

      expect(res.statusCode).toBe(401);
    });

    it('should require email field', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          password: 'TestPassword123',
        });

      expect(res.statusCode).toBe(400);
    });

    it('should require password field', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(res.statusCode).toBe(400);
    });

    it('should lock account after 5 failed attempts', async () => {
      await adminService.createAdmin({
        email: 'locktest@example.com',
        password: 'TestPassword123',
        name: 'Lock Test',
        role: 'admin',
      });

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email: 'locktest@example.com',
            password: 'WrongPassword',
          });
      }

      // 6th attempt should be blocked due to lockout
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'locktest@example.com',
          password: 'TestPassword123', // Even correct password should fail
        });

      expect(res.statusCode).toBe(429);
      expect(res.body.error.message).toContain('locked');
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password with valid token', async () => {
      const admin = await adminService.createAdmin({
        email: 'change@example.com',
        password: 'OldPassword123',
        name: 'Test Admin',
        role: 'admin',
      });

      // Generate a token
      const jwtSecret = process.env.JWT_SECRET || 'test-secret';
      const token = jwt.sign(
        { adminId: admin.id, email: admin.email, role: 'admin', adminRole: 'admin' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword456',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'change@example.com',
          password: 'NewPassword456',
        });

      expect(loginRes.statusCode).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const admin = await adminService.createAdmin({
        email: 'wrong@example.com',
        password: 'OldPassword123',
        name: 'Test Admin',
        role: 'admin',
      });

      const jwtSecret = process.env.JWT_SECRET || 'test-secret';
      const token = jwt.sign(
        { adminId: admin.id, email: admin.email, role: 'admin', adminRole: 'admin' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongOldPassword',
          newPassword: 'NewPassword456',
        });

      expect(res.statusCode).toBe(401);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/auth/change-password')
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword456',
        });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const admin = await adminService.createAdmin({
        email: 'me@example.com',
        password: 'TestPassword123',
        name: 'Test Admin',
        role: 'editor',
      });

      const jwtSecret = process.env.JWT_SECRET || 'test-secret';
      const token = jwt.sign(
        { adminId: admin.id, email: admin.email, role: 'admin', adminRole: 'editor' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('me@example.com');
      expect(res.body.user.role).toBe('editor');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /auth/validate', () => {
    it('should validate a valid admin token', async () => {
      const admin = await adminService.createAdmin({
        email: 'validate@example.com',
        password: 'TestPassword123',
        name: 'Test Admin',
        role: 'viewer',
      });

      const jwtSecret = process.env.JWT_SECRET || 'test-secret';
      const token = jwt.sign(
        { adminId: admin.id, email: admin.email, role: 'admin', adminRole: 'viewer' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/auth/validate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user.email).toBe('validate@example.com');
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/auth/validate')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should require token', async () => {
      const res = await request(app).get('/auth/validate');
      expect(res.statusCode).toBe(401);
    });
  });
});



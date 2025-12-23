/**
 * Integration Tests for Delta Sharing UI API
 * 
 * Tests the full API flow including authentication, shares, and recipients.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { prisma } from '../setup.js';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

// Helper to generate admin JWT token
function generateAdminToken(adminId: string, role: string = 'admin') {
  return jwt.sign(
    {
      adminId,
      email: 'test@example.com',
      name: 'Test Admin',
      role: 'admin',
      adminRole: role,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('API Integration Tests', () => {
  let adminId: string;
  let adminToken: string;
  let viewerToken: string;
  let editorToken: string;

  // Clean up and seed test data before tests
  beforeAll(async () => {
    // Clean up existing data
    await prisma.auditLog.deleteMany();
    await prisma.accessGrant.deleteMany();
    await prisma.recipientToken.deleteMany();
    await prisma.recipient.deleteMany();
    await prisma.table.deleteMany();
    await prisma.schema.deleteMany();
    await prisma.share.deleteMany();
    await prisma.adminUser.deleteMany();

    // Create test admin user
    const passwordHash = await bcrypt.hash('testpassword', 10);
    const admin = await prisma.adminUser.create({
      data: {
        email: 'admin@test.com',
        passwordHash,
        name: 'Test Admin',
        role: 'admin',
        mustChangePassword: false,
      },
    });
    adminId = admin.id;
    adminToken = generateAdminToken(adminId, 'admin');
    viewerToken = generateAdminToken(adminId, 'viewer');
    editorToken = generateAdminToken(adminId, 'editor');
  });

  // Clean up after each test
  afterEach(async () => {
    // Clean up test-created data
    await prisma.accessGrant.deleteMany();
    await prisma.recipientToken.deleteMany();
    await prisma.recipient.deleteMany();
    await prisma.table.deleteMany();
    await prisma.schema.deleteMany();
    await prisma.share.deleteMany();
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.adminUser.deleteMany();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/shares')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/shares')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Shares API', () => {
    it('should create a share', async () => {
      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'test_share', comment: 'Test share' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test_share');
    });

    it('should reject duplicate share names', async () => {
      // Create first share
      await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'duplicate_test' });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'duplicate_test' })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });

    it('should list shares', async () => {
      // Create some shares first
      await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'list_test_1' });

      await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'list_test_2' });

      const response = await request(app)
        .get('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should get share details', async () => {
      // Create a share
      const createRes = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'detail_test' });

      const response = await request(app)
        .get(`/api/shares/${createRes.body.data.name}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('detail_test');
    });

    it('should delete a share', async () => {
      // Create a share
      const createRes = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'delete_test' });

      await request(app)
        .delete(`/api/shares/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's deleted
      await request(app)
        .get(`/api/shares/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Schema API', () => {
    it('should create a schema in a share', async () => {
      // Create a share first
      const shareRes = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'schema_test' });

      const response = await request(app)
        .post(`/api/shares/${shareRes.body.data.id}/schemas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'default' })
        .expect(201);

      expect(response.body.data.name).toBe('default');
    });
  });

  describe('Recipients API', () => {
    it('should create a recipient', async () => {
      const response = await request(app)
        .post('/api/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'test_recipient',
          email: 'recipient@test.com',
          comment: 'Test recipient',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recipient.name).toBe('test_recipient');
      expect(response.body.data.credential).toBeDefined();
      expect(response.body.data.credential.bearerToken).toBeDefined();
    });

    it('should list recipients', async () => {
      // Create a recipient first
      await request(app)
        .post('/api/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'list_recipient' });

      const response = await request(app)
        .get('/api/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should get recipient details', async () => {
      // Create a recipient first
      const createRes = await request(app)
        .post('/api/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'detail_recipient' });

      const response = await request(app)
        .get(`/api/recipients/${createRes.body.data.recipient.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.name).toBe('detail_recipient');
    });

    it('should rotate recipient token', async () => {
      // Create a recipient
      const createRes = await request(app)
        .post('/api/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'rotate_recipient' });

      const originalToken = createRes.body.data.credential.bearerToken;

      // Rotate token
      const rotateRes = await request(app)
        .post(`/api/recipients/${createRes.body.data.recipient.id}/token/rotate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(rotateRes.body.data.credential.bearerToken).not.toBe(originalToken);
    });

    it('should grant and revoke share access', async () => {
      // Create a share
      const shareRes = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'access_test_share' });

      // Create a recipient
      const recipientRes = await request(app)
        .post('/api/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'access_recipient' });

      // Grant access
      await request(app)
        .post(`/api/recipients/${recipientRes.body.data.recipient.id}/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shareId: shareRes.body.data.id })
        .expect(200);

      // Check recipient has access
      const detailRes = await request(app)
        .get(`/api/recipients/${recipientRes.body.data.recipient.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(detailRes.body.data.shares).toContain('access_test_share');

      // Revoke access
      await request(app)
        .delete(`/api/recipients/${recipientRes.body.data.recipient.id}/access/${shareRes.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('RBAC - Role-Based Access Control', () => {
    it('should allow viewer to read shares', async () => {
      const response = await request(app)
        .get('/api/shares')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny viewer from creating shares', async () => {
      const response = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'viewer_share' })
        .expect(403);

      expect(response.body.error).toContain('Permission denied');
    });

    it('should deny viewer from deleting shares', async () => {
      // Create a share with admin
      const shareRes = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'rbac_delete_test' });

      // Try to delete with viewer
      await request(app)
        .delete(`/api/shares/${shareRes.body.data.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('should allow editor to create but not delete', async () => {
      // Editor should be able to create
      const createRes = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ name: 'editor_share' })
        .expect(201);

      expect(createRes.body.data.name).toBe('editor_share');

      // Editor should not be able to delete
      await request(app)
        .delete(`/api/shares/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403);
    });
  });

  describe('Rate Limiting', () => {
    it('should return rate limit headers', async () => {
      const response = await request(app)
        .get('/api/shares')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Audit Logs API', () => {
    it('should return audit logs', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('logs');
    });

    it('should return audit summary', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny viewer from exporting audit logs', async () => {
      await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });
});










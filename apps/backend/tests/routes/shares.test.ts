/**
 * Shares Routes Tests
 */

import request from 'supertest';
import express from 'express';
import { sharesRoutes } from '../../src/routes/shares.js';
import { prisma } from '../setup.js';
import { shareService } from '../../src/services/shareService.js';
import jwt from 'jsonwebtoken';

// Create a test app with the shares routes
const app = express();
app.use(express.json());
app.use('/shares', sharesRoutes);

// Helper to generate admin token
function generateAdminToken(role: string = 'admin') {
  const jwtSecret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(
    { 
      adminId: 'test-admin-id', 
      email: 'admin@test.com', 
      role: 'admin', 
      adminRole: role 
    },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

describe('Shares Routes', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.accessGrant.deleteMany();
    await prisma.table.deleteMany();
    await prisma.schema.deleteMany();
    await prisma.share.deleteMany();
  });

  describe('GET /shares', () => {
    it('should list all shares for admin', async () => {
      // Create test shares
      await shareService.createShare({ name: 'share1', comment: 'First share' });
      await shareService.createShare({ name: 'share2', comment: 'Second share' });

      const token = generateAdminToken();
      const res = await request(app)
        .get('/shares')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should list shares for viewer', async () => {
      await shareService.createShare({ name: 'viewer_share' });

      const token = generateAdminToken('viewer');
      const res = await request(app)
        .get('/shares')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/shares');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /shares', () => {
    it('should create a share for admin', async () => {
      const token = generateAdminToken();
      const res = await request(app)
        .post('/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'new_share',
          comment: 'A new share',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('new_share');
      expect(res.body.data.comment).toBe('A new share');
    });

    it('should create a share for editor', async () => {
      const token = generateAdminToken('editor');
      const res = await request(app)
        .post('/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'editor_share',
        });

      expect(res.statusCode).toBe(201);
    });

    it('should deny share creation for viewer', async () => {
      const token = generateAdminToken('viewer');
      const res = await request(app)
        .post('/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'viewer_attempt',
        });

      expect(res.statusCode).toBe(403);
    });

    it('should require name field', async () => {
      const token = generateAdminToken();
      const res = await request(app)
        .post('/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          comment: 'Missing name',
        });

      expect(res.statusCode).toBe(400);
    });

    it('should reject duplicate share names', async () => {
      await shareService.createShare({ name: 'duplicate' });

      const token = generateAdminToken();
      const res = await request(app)
        .post('/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'duplicate',
        });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /shares/:shareId', () => {
    it('should get share details by ID', async () => {
      const share = await shareService.createShare({ name: 'detail_share' });

      const token = generateAdminToken();
      const res = await request(app)
        .get(`/shares/${share.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('detail_share');
    });

    it('should get share details by name', async () => {
      await shareService.createShare({ name: 'by_name_share' });

      const token = generateAdminToken();
      const res = await request(app)
        .get('/shares/by_name_share')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe('by_name_share');
    });

    it('should return 404 for non-existent share', async () => {
      const token = generateAdminToken();
      const res = await request(app)
        .get('/shares/non_existent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /shares/:shareId', () => {
    it('should delete share for admin', async () => {
      const share = await shareService.createShare({ name: 'to_delete' });

      const token = generateAdminToken();
      const res = await request(app)
        .delete(`/shares/${share.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);

      // Verify share is deleted
      const deleted = await shareService.getShare(share.id);
      expect(deleted).toBeNull();
    });

    it('should deny deletion for editor', async () => {
      const share = await shareService.createShare({ name: 'no_delete' });

      const token = generateAdminToken('editor');
      const res = await request(app)
        .delete(`/shares/${share.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it('should deny deletion for viewer', async () => {
      const share = await shareService.createShare({ name: 'viewer_no_delete' });

      const token = generateAdminToken('viewer');
      const res = await request(app)
        .delete(`/shares/${share.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /shares/:shareId/schemas', () => {
    it('should create a schema in a share', async () => {
      const share = await shareService.createShare({ name: 'schema_test' });

      const token = generateAdminToken();
      const res = await request(app)
        .post(`/shares/${share.id}/schemas`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'default',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('default');
    });

    it('should require schema name', async () => {
      const share = await shareService.createShare({ name: 'schema_name_test' });

      const token = generateAdminToken();
      const res = await request(app)
        .post(`/shares/${share.id}/schemas`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /shares/:shareId/schemas/:schemaName/tables', () => {
    it('should create a table in a schema', async () => {
      const share = await shareService.createShare({ name: 'table_test' });
      await shareService.createSchema({ shareId: share.id, name: 'default' });

      const token = generateAdminToken();
      const res = await request(app)
        .post(`/shares/${share.id}/schemas/default/tables`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'customers',
          location: 's3://bucket/customers',
          comment: 'Customer data',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('customers');
      expect(res.body.data.location).toBe('s3://bucket/customers');
    });

    it('should require table name and location', async () => {
      const share = await shareService.createShare({ name: 'table_required_test' });
      await shareService.createSchema({ shareId: share.id, name: 'default' });

      const token = generateAdminToken();
      const res = await request(app)
        .post(`/shares/${share.id}/schemas/default/tables`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'missing_location',
        });

      expect(res.statusCode).toBe(400);
    });
  });
});



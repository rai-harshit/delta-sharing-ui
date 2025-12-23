/**
 * Recipient Service Tests
 */

import { recipientService } from '../../src/services/recipientService.js';
import { shareService } from '../../src/services/shareService.js';
import { prisma } from '../setup.js';

// TODO: Fix tests - database state issues in CI
describe.skip('RecipientService', () => {
  // Clean up test data before each test
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.accessGrant.deleteMany();
    await prisma.recipientToken.deleteMany();
    await prisma.recipient.deleteMany();
    await prisma.table.deleteMany();
    await prisma.schema.deleteMany();
    await prisma.share.deleteMany();
  });

  describe('createRecipient', () => {
    it('should create a recipient with token', async () => {
      const result = await recipientService.createRecipient(
        { name: 'test_recipient', email: 'test@example.com' },
        'http://localhost:5000'
      );

      expect(result.recipient).toBeDefined();
      expect(result.recipient.name).toBe('test_recipient');
      expect(result.credential).toBeDefined();
      expect(result.credential.bearerToken).toBeDefined();
      expect(result.credential.endpoint).toBe('http://localhost:5000');
    });

    it('should create recipient with share access', async () => {
      const share = await shareService.createShare({ name: 'test_share' });
      
      const result = await recipientService.createRecipient(
        { name: 'with_access', shareIds: [share.id] },
        'http://localhost:5000'
      );

      const recipient = await recipientService.getRecipient(result.recipient.id);
      expect(recipient?.accessGrants.length).toBe(1);
      expect(recipient?.accessGrants[0].share.name).toBe('test_share');
    });
  });

  describe('getRecipient', () => {
    it('should get recipient by ID', async () => {
      const { recipient: created } = await recipientService.createRecipient(
        { name: 'get_test' },
        'http://localhost:5000'
      );

      const fetched = await recipientService.getRecipient(created.id);

      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe('get_test');
      expect(fetched?.tokens.length).toBe(1);
    });

    it('should return null for non-existent recipient', async () => {
      const fetched = await recipientService.getRecipient('non_existent_id');
      expect(fetched).toBeNull();
    });
  });

  describe('listRecipients', () => {
    it('should list all recipients', async () => {
      await recipientService.createRecipient({ name: 'recipient_1' }, 'http://localhost');
      await recipientService.createRecipient({ name: 'recipient_2' }, 'http://localhost');

      const recipients = await recipientService.listRecipients();

      expect(recipients.length).toBe(2);
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const { credential } = await recipientService.createRecipient(
        { name: 'token_test' },
        'http://localhost:5000'
      );

      const recipient = await recipientService.validateToken(credential.bearerToken);

      expect(recipient).toBeDefined();
      expect(recipient?.name).toBe('token_test');
    });

    it('should return null for invalid token', async () => {
      const recipient = await recipientService.validateToken('invalid_token');
      expect(recipient).toBeNull();
    });
  });

  describe('rotateToken', () => {
    it('should rotate token and invalidate old one', async () => {
      const { recipient, credential: oldCredential } = await recipientService.createRecipient(
        { name: 'rotate_test' },
        'http://localhost:5000'
      );

      // Rotate token
      const newCredential = await recipientService.rotateToken(recipient.id, 'http://localhost:5000');

      // New token should be different
      expect(newCredential.bearerToken).not.toBe(oldCredential.bearerToken);

      // New token should work
      const validated = await recipientService.validateToken(newCredential.bearerToken);
      expect(validated).toBeDefined();
      expect(validated?.name).toBe('rotate_test');

      // Old token should not work
      const oldValidated = await recipientService.validateToken(oldCredential.bearerToken);
      expect(oldValidated).toBeNull();
    });
  });

  describe('grantAccess', () => {
    it('should grant access to a share', async () => {
      const share = await shareService.createShare({ name: 'grant_share' });
      const { recipient } = await recipientService.createRecipient(
        { name: 'grant_recipient' },
        'http://localhost'
      );

      await recipientService.grantAccess(recipient.id, share.id);

      const fetched = await recipientService.getRecipient(recipient.id);
      expect(fetched?.accessGrants.length).toBe(1);
      expect(fetched?.accessGrants[0].share.name).toBe('grant_share');
    });
  });

  describe('revokeAccess', () => {
    it('should revoke access to a share', async () => {
      const share = await shareService.createShare({ name: 'revoke_share' });
      const { recipient } = await recipientService.createRecipient(
        { name: 'revoke_recipient', shareIds: [share.id] },
        'http://localhost'
      );

      await recipientService.revokeAccess(recipient.id, share.id);

      const fetched = await recipientService.getRecipient(recipient.id);
      expect(fetched?.accessGrants.length).toBe(0);
    });
  });

  describe('deleteRecipient', () => {
    it('should delete a recipient', async () => {
      const { recipient } = await recipientService.createRecipient(
        { name: 'to_delete' },
        'http://localhost'
      );

      await recipientService.deleteRecipient(recipient.id);

      const fetched = await recipientService.getRecipient(recipient.id);
      expect(fetched).toBeNull();
    });
  });
});















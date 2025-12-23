import { prisma } from '../db/client.js';

export interface CreateShareInput {
  name: string;
  comment?: string;
  createdBy?: string;
}

export interface CreateSchemaInput {
  shareId: string;
  name: string;
}

export interface CreateTableInput {
  schemaId: string;
  name: string;
  location: string;
  comment?: string;
  alias?: string; // Display name shown to recipients
}

export const shareService = {
  // Share operations
  async createShare(data: CreateShareInput) {
    return prisma.share.create({
      data: {
        name: data.name,
        comment: data.comment,
        createdBy: data.createdBy,
      },
    });
  },

  async getShare(id: string) {
    return prisma.share.findFirst({
      where: {
        OR: [{ id }, { name: id }],
      },
      include: {
        schemas: {
          include: {
            tables: true,
          },
        },
        accessGrants: {
          include: {
            recipient: true,
          },
        },
      },
    });
  },

  async getShareByName(name: string) {
    return prisma.share.findUnique({
      where: { name },
      include: {
        schemas: {
          include: {
            tables: true,
          },
        },
      },
    });
  },

  async listShares() {
    return prisma.share.findMany({
      include: {
        schemas: {
          include: {
            tables: true,
          },
        },
        _count: {
          select: {
            accessGrants: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listSharesForRecipient(recipientId: string) {
    const grants = await prisma.accessGrant.findMany({
      where: {
        recipientId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        share: {
          include: {
            schemas: {
              include: {
                tables: true,
              },
            },
          },
        },
      },
    });

    return grants.map(g => g.share);
  },

  async updateShare(id: string, data: Partial<CreateShareInput>) {
    return prisma.share.update({
      where: { id },
      data,
    });
  },

  async deleteShare(id: string) {
    return prisma.share.delete({
      where: { id },
    });
  },

  // Schema operations
  async createSchema(data: CreateSchemaInput) {
    return prisma.schema.create({
      data: {
        name: data.name,
        shareId: data.shareId,
      },
    });
  },

  async listSchemas(shareId: string) {
    // First find the share by id or name
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareId }, { name: shareId }],
      },
    });

    if (!share) return [];

    return prisma.schema.findMany({
      where: { shareId: share.id },
      orderBy: { name: 'asc' },
    });
  },

  async deleteSchema(id: string) {
    return prisma.schema.delete({
      where: { id },
    });
  },

  // Table operations
  async createTable(data: CreateTableInput) {
    return prisma.table.create({
      data: {
        name: data.name,
        alias: data.alias,
        schemaId: data.schemaId,
        location: data.location,
        comment: data.comment,
      },
    });
  },

  async listTables(shareIdOrName: string, schemaName: string) {
    // First find the share
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareIdOrName }, { name: shareIdOrName }],
      },
    });

    if (!share) return [];

    // Then find the schema
    const schema = await prisma.schema.findFirst({
      where: {
        shareId: share.id,
        name: schemaName,
      },
    });

    if (!schema) return [];

    return prisma.table.findMany({
      where: { schemaId: schema.id },
      orderBy: { name: 'asc' },
    });
  },

  async listAllTables(shareIdOrName: string) {
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareIdOrName }, { name: shareIdOrName }],
      },
      include: {
        schemas: {
          include: {
            tables: true,
          },
        },
      },
    });

    if (!share) return [];

    return share.schemas.flatMap(schema =>
      schema.tables.map(table => ({
        ...table,
        schema: schema.name,
        share: share.name,
      }))
    );
  },

  async getTable(shareIdOrName: string, schemaName: string, tableName: string) {
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareIdOrName }, { name: shareIdOrName }],
      },
    });

    if (!share) return null;

    const schema = await prisma.schema.findFirst({
      where: {
        shareId: share.id,
        name: schemaName,
      },
    });

    if (!schema) return null;

    // Search by name OR alias (recipients may use either)
    return prisma.table.findFirst({
      where: {
        schemaId: schema.id,
        OR: [
          { name: tableName },
          { alias: tableName },
        ],
      },
    });
  },

  async deleteTable(id: string) {
    return prisma.table.delete({
      where: { id },
    });
  },

  // Check if recipient has access to a share
  async checkAccess(recipientId: string, shareIdOrName: string): Promise<boolean> {
    const grant = await this.getAccessGrant(recipientId, shareIdOrName);
    return !!grant;
  },

  // Get the access grant with permissions
  async getAccessGrant(recipientId: string, shareIdOrName: string) {
    const share = await prisma.share.findFirst({
      where: {
        OR: [{ id: shareIdOrName }, { name: shareIdOrName }],
      },
    });

    if (!share) return null;

    return prisma.accessGrant.findFirst({
      where: {
        recipientId,
        shareId: share.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        share: true,
        recipient: true,
      },
    });
  },

  // Get all shared assets (tables with schema and share info)
  async getAllAssets() {
    const tables = await prisma.table.findMany({
      include: {
        schema: {
          include: {
            share: {
              include: {
                accessGrants: {
                  where: {
                    OR: [
                      { expiresAt: null },
                      { expiresAt: { gt: new Date() } },
                    ],
                  },
                  select: {
                    recipientId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get unique schemas count
    const schemas = await prisma.schema.findMany({
      include: {
        share: true,
        _count: {
          select: { tables: true },
        },
      },
    });

    // Get shares count
    const sharesCount = await prisma.share.count();

    return {
      summary: {
        totalTables: tables.length,
        totalSchemas: schemas.length,
        totalShares: sharesCount,
      },
      tables: tables.map(table => ({
        id: table.id,
        name: table.name,
        alias: table.alias,
        location: table.location,
        schemaName: table.schema.name,
        schemaId: table.schema.id,
        shareName: table.schema.share.name,
        shareId: table.schema.share.id,
        recipientCount: table.schema.share.accessGrants.length,
        createdAt: table.createdAt,
      })),
      schemas: schemas.map(schema => ({
        id: schema.id,
        name: schema.name,
        shareName: schema.share.name,
        shareId: schema.share.id,
        tableCount: schema._count.tables,
      })),
    };
  },
};



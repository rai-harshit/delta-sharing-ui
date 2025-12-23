/**
 * OpenAPI Specification for Delta Sharing UI API
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Delta Sharing UI API',
    description: 'REST API for managing Delta Sharing shares and recipients',
    version: '1.0.0',
    contact: {
      name: 'Delta Sharing UI',
    },
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Shares', description: 'Share management' },
    { name: 'Schemas', description: 'Schema management' },
    { name: 'Tables', description: 'Table management' },
    { name: 'Recipients', description: 'Recipient management' },
    { name: 'Recipient Portal', description: 'Recipient data access' },
    { name: 'Delta Protocol', description: 'Standard Delta Sharing protocol endpoints' },
    { name: 'Storage', description: 'Storage configuration management' },
    { name: 'Audit', description: 'Audit logs and analytics' },
    { name: 'Health', description: 'Health check' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        operationId: 'healthCheck',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Admin login',
        operationId: 'adminLogin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/recipient/login': {
      post: {
        tags: ['Auth'],
        summary: 'Recipient login with bearer token',
        operationId: 'recipientLogin',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['endpoint', 'bearerToken'],
                properties: {
                  endpoint: { type: 'string', format: 'uri' },
                  bearerToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecipientAuthResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/shares': {
      get: {
        tags: ['Shares'],
        summary: 'List all shares',
        operationId: 'listShares',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of shares',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SharesResponse',
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Shares'],
        summary: 'Create a new share',
        operationId: 'createShare',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Share created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Share' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/shares/{shareId}': {
      get: {
        tags: ['Shares'],
        summary: 'Get share details',
        operationId: 'getShare',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
        ],
        responses: {
          200: {
            description: 'Share details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShareDetail' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Shares'],
        summary: 'Delete a share',
        operationId: 'deleteShare',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
        ],
        responses: {
          200: { description: 'Share deleted' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/shares/{shareId}/schemas': {
      get: {
        tags: ['Schemas'],
        summary: 'List schemas in a share',
        operationId: 'listSchemas',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
        ],
        responses: {
          200: {
            description: 'List of schemas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SchemasResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Schemas'],
        summary: 'Create a schema',
        operationId: 'createSchema',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Schema created' },
        },
      },
    },
    '/shares/{shareId}/schemas/{schemaName}/tables': {
      get: {
        tags: ['Tables'],
        summary: 'List tables in a schema',
        operationId: 'listTables',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
          { $ref: '#/components/parameters/schemaName' },
        ],
        responses: {
          200: {
            description: 'List of tables',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TablesResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Tables'],
        summary: 'Create a table',
        operationId: 'createTable',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
          { $ref: '#/components/parameters/schemaName' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'location'],
                properties: {
                  name: { type: 'string' },
                  location: { type: 'string' },
                  comment: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Table created' },
        },
      },
    },
    '/shares/{shareId}/schemas/{schemaName}/tables/{tableName}/preview': {
      get: {
        tags: ['Tables'],
        summary: 'Preview table data',
        operationId: 'previewTable',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/shareId' },
          { $ref: '#/components/parameters/schemaName' },
          { $ref: '#/components/parameters/tableName' },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100, maximum: 1000 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          200: {
            description: 'Table preview',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TablePreview' },
              },
            },
          },
        },
      },
    },
    '/recipients': {
      get: {
        tags: ['Recipients'],
        summary: 'List all recipients',
        operationId: 'listRecipients',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of recipients',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecipientsResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Recipients'],
        summary: 'Create a recipient',
        operationId: 'createRecipient',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  shares: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Recipient created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecipientWithCredential' },
              },
            },
          },
        },
      },
    },
    '/recipients/{recipientId}/token/rotate': {
      post: {
        tags: ['Recipients'],
        summary: 'Rotate recipient token',
        operationId: 'rotateToken',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/recipientId' },
        ],
        responses: {
          200: {
            description: 'New credential generated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecipientWithCredential' },
              },
            },
          },
        },
      },
    },
    '/recipient/shares': {
      get: {
        tags: ['Recipient Portal'],
        summary: 'List accessible shares',
        operationId: 'listRecipientShares',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Accessible shares',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RecipientSharesResponse' },
              },
            },
          },
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Audit'],
        summary: 'Query audit logs',
        operationId: 'getAuditLogs',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'recipientId', in: 'query', schema: { type: 'string' } },
          { name: 'shareName', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['success', 'error'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Audit logs',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuditLogsResponse' },
              },
            },
          },
        },
      },
    },
    '/admin/audit-logs/summary': {
      get: {
        tags: ['Audit'],
        summary: 'Get audit summary statistics',
        operationId: 'getAuditSummary',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: {
          200: {
            description: 'Audit summary',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuditSummary' },
              },
            },
          },
        },
      },
    },
    '/admin/audit-logs/export': {
      get: {
        tags: ['Audit'],
        summary: 'Export audit logs as CSV',
        operationId: 'exportAuditLogs',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'recipientId', in: 'query', schema: { type: 'string' } },
          { name: 'shareName', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'CSV file',
            content: {
              'text/csv': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/delta/shares': {
      get: {
        tags: ['Delta Protocol'],
        summary: 'List shares (Delta Sharing Protocol)',
        description: 'Standard Delta Sharing protocol endpoint for listing shares accessible to the recipient',
        operationId: 'deltaListShares',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of shares',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          id: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/delta/shares/{shareName}/schemas': {
      get: {
        tags: ['Delta Protocol'],
        summary: 'List schemas in a share (Delta Sharing Protocol)',
        operationId: 'deltaListSchemas',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shareName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of schemas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          share: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/delta/shares/{shareName}/schemas/{schemaName}/tables': {
      get: {
        tags: ['Delta Protocol'],
        summary: 'List tables in a schema (Delta Sharing Protocol)',
        operationId: 'deltaListTables',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shareName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'schemaName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'List of tables',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          schema: { type: 'string' },
                          share: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/delta/shares/{shareName}/schemas/{schemaName}/tables/{tableName}/metadata': {
      get: {
        tags: ['Delta Protocol'],
        summary: 'Get table metadata (Delta Sharing Protocol)',
        operationId: 'deltaGetTableMetadata',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shareName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'schemaName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tableName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Table metadata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeltaTableMetadata' },
              },
            },
          },
        },
      },
    },
    '/delta/shares/{shareName}/schemas/{schemaName}/tables/{tableName}/query': {
      post: {
        tags: ['Delta Protocol'],
        summary: 'Query table data (Delta Sharing Protocol)',
        operationId: 'deltaQueryTable',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shareName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'schemaName', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tableName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  limitHint: { type: 'integer', default: 1000 },
                  offset: { type: 'integer', default: 0 },
                  predicateHints: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Query result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    rows: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                    rowCount: { type: 'integer' },
                    hasMore: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/storage': {
      get: {
        tags: ['Storage'],
        summary: 'List storage configurations',
        operationId: 'listStorageConfigs',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of storage configurations',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageConfigsResponse' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Storage'],
        summary: 'Create storage configuration',
        operationId: 'createStorageConfig',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StorageConfigInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Storage configuration created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageConfig' },
              },
            },
          },
        },
      },
    },
    '/storage/{configId}': {
      get: {
        tags: ['Storage'],
        summary: 'Get storage configuration',
        operationId: 'getStorageConfig',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'configId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Storage configuration',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageConfig' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Storage'],
        summary: 'Delete storage configuration',
        operationId: 'deleteStorageConfig',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'configId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Storage configuration deleted' },
        },
      },
    },
    '/storage/{configId}/browse': {
      get: {
        tags: ['Storage'],
        summary: 'Browse storage contents',
        operationId: 'browseStorage',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'configId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'bucket', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'prefix', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Storage contents',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StorageBrowseResult' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    parameters: {
      shareId: {
        name: 'shareId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Share ID or name',
      },
      schemaName: {
        name: 'schemaName',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      tableName: {
        name: 'tableName',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      recipientId: {
        name: 'recipientId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
      },
      RecipientAuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  serverUrl: { type: 'string' },
                  recipientId: { type: 'string' },
                  recipientName: { type: 'string' },
                },
              },
            },
          },
        },
      },
      Share: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          comment: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          createdBy: { type: 'string' },
        },
      },
      ShareDetail: {
        allOf: [
          { $ref: '#/components/schemas/Share' },
          {
            type: 'object',
            properties: {
              schemas: {
                type: 'array',
                items: { $ref: '#/components/schemas/Schema' },
              },
              recipients: {
                type: 'array',
                items: { $ref: '#/components/schemas/Recipient' },
              },
            },
          },
        ],
      },
      SharesResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Share' },
          },
        },
      },
      Schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          share: { type: 'string' },
        },
      },
      SchemasResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Schema' },
          },
        },
      },
      Table: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          schema: { type: 'string' },
          share: { type: 'string' },
        },
      },
      TablesResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Table' },
          },
        },
      },
      TablePreview: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              rows: {
                type: 'array',
                items: { type: 'object' },
              },
              totalRows: { type: 'integer' },
              hasMore: { type: 'boolean' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
        },
      },
      Recipient: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          shares: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      RecipientsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Recipient' },
          },
        },
      },
      RecipientWithCredential: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              recipient: { $ref: '#/components/schemas/Recipient' },
              credential: { $ref: '#/components/schemas/Credential' },
            },
          },
        },
      },
      Credential: {
        type: 'object',
        properties: {
          shareCredentialsVersion: { type: 'integer' },
          endpoint: { type: 'string' },
          bearerToken: { type: 'string' },
          expirationTime: { type: 'string' },
        },
      },
      RecipientSharesResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                schemas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      tables: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Table' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          action: { type: 'string' },
          recipientId: { type: 'string' },
          recipientName: { type: 'string' },
          shareName: { type: 'string' },
          schemaName: { type: 'string' },
          tableName: { type: 'string' },
          status: { type: 'string', enum: ['success', 'error'] },
          rowsAccessed: { type: 'integer' },
          durationMs: { type: 'integer' },
        },
      },
      AuditLogsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              logs: {
                type: 'array',
                items: { $ref: '#/components/schemas/AuditLog' },
              },
              total: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      AuditSummary: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              totalQueries: { type: 'integer' },
              totalRowsAccessed: { type: 'integer' },
              uniqueRecipients: { type: 'integer' },
              uniqueShares: { type: 'integer' },
              successRate: { type: 'number' },
              recentActivity: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      DeltaTableMetadata: {
        type: 'object',
        properties: {
          protocol: {
            type: 'object',
            properties: {
              minReaderVersion: { type: 'integer' },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              format: {
                type: 'object',
                properties: {
                  provider: { type: 'string' },
                },
              },
              schemaString: { type: 'string' },
              partitionColumns: {
                type: 'array',
                items: { type: 'string' },
              },
              numFiles: { type: 'integer' },
              size: { type: 'integer' },
              version: { type: 'integer' },
            },
          },
        },
      },
      StorageConfig: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['s3', 'azure', 'gcs'] },
          isDefault: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      StorageConfigInput: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['s3', 'azure', 'gcs'] },
          isDefault: { type: 'boolean' },
          s3Region: { type: 'string' },
          s3AccessKeyId: { type: 'string' },
          s3SecretKey: { type: 'string' },
          s3Endpoint: { type: 'string' },
          azureAccount: { type: 'string' },
          azureAccessKey: { type: 'string' },
          azureConnectionStr: { type: 'string' },
          gcsProjectId: { type: 'string' },
          gcsKeyFile: { type: 'string' },
        },
      },
      StorageConfigsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/StorageConfig' },
          },
        },
      },
      StorageBrowseResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    path: { type: 'string' },
                    size: { type: 'integer' },
                    lastModified: { type: 'string', format: 'date-time' },
                    isDirectory: { type: 'boolean' },
                    isDeltaTable: { type: 'boolean' },
                  },
                },
              },
              prefix: { type: 'string' },
              bucket: { type: 'string' },
            },
          },
        },
      },
    },
  },
};







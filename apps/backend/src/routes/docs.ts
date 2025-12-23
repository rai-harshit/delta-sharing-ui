import { Router, Request, Response } from 'express';
import { openApiSpec } from '../openapi.js';

const router = Router();

/**
 * GET /api/docs
 * Serves the OpenAPI specification as JSON
 */
router.get('/', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

/**
 * GET /api/docs/ui
 * Serves a simple Swagger UI HTML page
 */
router.get('/ui', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delta Sharing UI - API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 2em; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        docExpansion: 'list'
      });
    };
  </script>
</body>
</html>
  `;
  res.type('html').send(html);
});

/**
 * GET /api/docs/redoc
 * Serves a ReDoc HTML page (alternative to Swagger UI)
 */
router.get('/redoc', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delta Sharing UI - API Documentation</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <redoc spec-url='/api/docs'></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
  `;
  res.type('html').send(html);
});

export { router as docsRoutes };















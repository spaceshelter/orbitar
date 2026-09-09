import { Application } from 'express'
import j2s from 'joi-to-swagger'

import { config } from '../../config'
import { ExpressOauth2ScopesFilter } from '../OAuth2Middleware'
import { extractRouteInfo, RouteInfo } from './express-reflection'

/**
 * OpenAPI specification object with complete type definitions
 */
interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description: string
    version: string
  }
  servers: {
    url: string
    description: string
  }[]
  paths: Record<string, Record<string, unknown>>
  components: {
    schemas: Record<string, unknown>
    securitySchemes: {
      oauth2: {
        type: string
        flows: {
          authorizationCode: {
            authorizationUrl: string
            tokenUrl: string
            scopes: Record<string, string>
          }
        }
      } & Record<string, unknown>
    } & Record<string, unknown>
  }
  tags: {
    name: string
    description: string
  }[]
}

// Remove JoiRule, JoiDescription, and SchemaWithDescribe interfaces since we're using joi-to-swagger

/**
 * Generates OpenAPI documentation from an Express application
 */
interface Controller {
  router: unknown
}

export class OpenApiGenerator {
  private app: Application
  private scopesFilter: ExpressOauth2ScopesFilter
  private controllers: Controller[] = []

  constructor(app: Application, controllers?: Controller[]) {
    this.app = app
    this.scopesFilter = new ExpressOauth2ScopesFilter(app)
    this.controllers = controllers || []
  }

  /**
   * Generate an OpenAPI specification from the Express app routes
   */
  generateSpec(): OpenAPISpec {
    // Get routes from the Express app
    let routes = extractRouteInfo(this.app)

    // If we have controllers, process each controller's router directly
    if (this.controllers.length > 0) {
      this.controllers.forEach((controller) => {
        if (controller.router) {
          // Extract routes from the controller's router
          const controllerRoutes = extractRouteInfo({ _router: controller.router } as unknown as Application)

          // Add the prefix /api/v1 to each route
          controllerRoutes.forEach((route) => {
            route.path = '/api/v1' + route.path
          })

          // Add to our routes
          routes = [...routes, ...controllerRoutes]
        }
      })
    }

    const scopeDescriptions = this.scopesFilter.getScopesToDescriptions()

    // Construct the base URLs using config values
    const protocol = config.site.http ? 'http' : 'https'
    const domain = config.site.domain
    const baseUrl = `${protocol}://${domain}`
    const apiDomain = `api.${domain}`
    const apiBaseUrl = `${protocol}://${apiDomain}/api/v1`

    // Base OpenAPI specification
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: {
        title: 'Orbitar API',
        description: 'API for Orbitar platform',
        version: '1.0.0',
      },
      servers: [
        {
          url: apiBaseUrl,
          description: 'API Server',
        },
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: `${baseUrl}/oauth2/authorize`,
                tokenUrl: `${protocol}://${apiDomain}/api/v1/oauth2/token`,
                scopes: {},
              },
            },
          },
        },
      },
      tags: [],
    }

    // Group routes by tag (first path segment)
    const routesByTag: Record<string, RouteInfo[]> = {}

    // First, populate OAuth2 scopes
    Object.entries(scopeDescriptions).forEach(([scope, description]) => {
      if (scope && description) {
        spec.components.securitySchemes.oauth2.flows.authorizationCode.scopes[scope] = description
      }
    })

    // Then process routes
    routes.forEach((route) => {
      // Only include API routes that match our API pattern and exclude our own documentation routes
      if (route.path.startsWith('/api/v1/') && !route.path.startsWith('/api/v1/docs')) {
        const pathParts = route.path.split('/')
        const tag = pathParts.length > 3 ? pathParts[3] : 'default' // Use the part after /api/v1/ as the tag

        if (!routesByTag[tag]) {
          routesByTag[tag] = []
        }

        routesByTag[tag].push(route)
      }
    })

    // Add tags
    Object.keys(routesByTag).forEach((tag) => {
      spec.tags.push({
        name: tag,
        description: `${tag.charAt(0).toUpperCase() + tag.slice(1)} related operations`,
      })
    })

    // Create paths
    routes.forEach((route) => {
      // Extract tag from the path after /api/v1/
      const pathParts = route.path.split('/')
      const tag = pathParts.length > 3 ? pathParts[3] : 'default'

      // Remove the /api/v1 prefix for cleaner paths in the docs
      const apiPath = route.path.replace(/^\/api\/v1/, '')
      const cleanPath = this.expressPathToOpenApiPath(apiPath)
      const method = route.method.toLowerCase()

      if (!spec.paths[cleanPath]) {
        spec.paths[cleanPath] = {}
      }

      const pathItem: Record<string, unknown> = {
        tags: [tag],
        summary: route.scopeDescription || `${method} ${route.path}`,
        description: route.scopeDescription || `${method} ${route.path}`,
        security: [
          {
            oauth2: this.getRequiredScopes(route.path),
          },
        ],
        responses: {
          '200': {
            description: 'Successful operation',
          },
          '401': {
            description: 'Unauthorized',
          },
          '403': {
            description: 'Forbidden',
          },
          '500': {
            description: 'Internal Server Error',
          },
        },
      }

      // If we have a validation schema, try to extract parameter information
      if (route.validationSchema) {
        const openApiSchema = this.joiSchemaToOpenApi(route.validationSchema)

        pathItem.requestBody = {
          description: 'Request payload',
          required: true,
          content: {
            'application/json': {
              schema: openApiSchema,
            },
          },
        }
      }

      spec.paths[cleanPath][method] = pathItem
    })

    return spec
  }

  /**
   * Convert Express route paths to OpenAPI path format
   * e.g. '/post/:id' -> '/post/{id}'
   */
  private expressPathToOpenApiPath(path: string): string {
    return path.replace(/:([^/]+)/g, '{$1}')
  }

  /**
   * Get the OAuth2 scopes required for a route
   */
  private getRequiredScopes(path: string): string[] {
    // Remove '/api/v1' prefix from path before converting to scopes
    // This ensures scope names don't include the API version prefix
    const cleanPath = path.replace(/^\/api\/v1/, '')
    return ExpressOauth2ScopesFilter.pathToScopesList(cleanPath)
  }

  /**
   * Convert Joi schema to OpenAPI schema using joi-to-swagger
   */
  private joiSchemaToOpenApi(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object' }
    }

    try {
      // Use joi-to-swagger to convert the schema
      const { swagger } = j2s(schema as any)
      return swagger
    } catch (error) {
      console.error('Failed to convert Joi schema', error)
      return { type: 'object' }
    }
  }
}

/**
 * Create an Express route to serve OpenAPI documentation
 */
export function createOpenApiDocRoutes(app: Application, controllers?: Controller[]) {
  const generator = new OpenApiGenerator(app, controllers)

  // Create an endpoint that serves the OpenAPI JSON
  app.get('/api/v1/docs/openapi.json', (req, res) => {
    const spec = generator.generateSpec()
    res.json(spec)
  })

  // This endpoint would serve Swagger UI
  app.get('/api/v1/docs', (req, res) => {
    // Construct the redirect URL for OAuth2
    const protocol = config.site.http ? 'http' : 'https'
    const domain = config.site.domain
    // FIXME: This should be a config value
    const redirectUrl = `${protocol}://api.${domain}/api/v1/docs/oauth2-redirect.html`

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Orbitar API Documentation</title>
          <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css">
          <style>
            .oauth-info {
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 15px;
              margin: 20px 0;
            }
            .oauth-info code {
              background-color: #e9ecef;
              padding: 2px 4px;
              border-radius: 3px;
            }
          </style>
        </head>
        <body>
          <div class="oauth-info">
            <h3>OAuth2 Configuration</h3>
            <p>When configuring your OAuth2 client, make sure to set the following redirect URL:</p>
            <code>${redirectUrl}</code>
          </div>
          <div id="swagger-ui"></div>
          <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
          <script>
            window.onload = function() {
              // Initialize Swagger UI
              const ui = SwaggerUIBundle({
                url: "/api/v1/docs/openapi.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                oauth2RedirectUrl: "${redirectUrl}",
                // Fix for OAuth2 flow
                withCredentials: true,
                responseInterceptor: (response) => {
                  // Log OAuth responses for debugging
                  if (response.url && response.url.includes('/oauth2/')) {
                    console.log('OAuth2 Response:', response);
                  }
                  return response;
                },
                requestInterceptor: (req) => {
                  // For OAuth2 requests, ensure scope parameter is included
                  if (req.url.includes('/oauth2/authorize') && !req.url.includes('scope=')) {
                    try {
                      // We'll add the scopes parameter on the client side
                      const spec = ui.getSystem().specSelectors.specJson().toJS();
                      if (spec && spec.components && spec.components.securitySchemes && 
                          spec.components.securitySchemes.oauth2 && 
                          spec.components.securitySchemes.oauth2.flows.authorizationCode.scopes) {
                        
                        const availableScopes = Object.keys(spec.components.securitySchemes.oauth2.flows.authorizationCode.scopes).join(' ');
                        req.url += (req.url.includes('?') ? '&' : '?') + 'scope=' + encodeURIComponent(availableScopes);
                        console.log('Added scopes to authorization URL:', availableScopes);
                      }
                    } catch (e) {
                      console.error('Error adding scopes:', e);
                    }
                  }
                  
                  // Log all OAuth2 requests
                  if (req.url && req.url.includes('/oauth2/')) {
                    console.log('OAuth2 Request:', req);
                  }
                  
                  return req;
                },
                // Add OAuth client configuration to preserve state
                persistAuthorization: true,
                onComplete: function() {
                  console.log('Swagger UI initialized');
                }
              });
              
              window.ui = ui;
            };
          </script>
        </body>
      </html>
    `)
  })

  // Serve the OAuth2 redirect page for Swagger UI
  app.get('/api/v1/docs/oauth2-redirect.html', (req, res) => {
    res.send(`
      <!doctype html>
      <html lang="en-US">
      <head>
        <title>Swagger UI: OAuth2 Redirect</title>
        <style>
          body {
            font-family: sans-serif;
            padding: 20px;
          }
          .debug-info {
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
            white-space: pre-wrap;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
      <div id="debug-info" class="debug-info"></div>
      <script>
        'use strict';
        function run () {
          const debugInfo = document.getElementById('debug-info');
          try {
            const logInfo = function(msg) {
              console.log(msg);
              debugInfo.innerHTML += msg + '\\n';
            };

            // Log the URL data for debugging
            logInfo('URL: ' + window.location.href);
            logInfo('Search: ' + window.location.search);
            logInfo('Hash: ' + window.location.hash);

            var oauth2 = window.opener.swaggerUIRedirectOauth2;
            if (!oauth2) {
              logInfo('ERROR: swaggerUIRedirectOauth2 not found in window.opener');
              return;
            }

            var sentState = oauth2.state;
            var redirectUrl = oauth2.redirectUrl;
            logInfo('Redirect URL: ' + redirectUrl);
            logInfo('State: ' + sentState);

            var isValid, qp = {}, params;

            // First check the search parameters
            if (window.location.search && window.location.search.length > 1) {
              params = new URLSearchParams(window.location.search.substring(1));
              for (let [key, value] of params.entries()) {
                qp[key] = value;
              }
              logInfo('Parsed from search: ' + JSON.stringify(qp));
            }
            
            // Then check the hash parameters if no code was found
            if (!qp.code && window.location.hash && window.location.hash.length > 1) {
              params = new URLSearchParams(window.location.hash.substring(1));
              for (let [key, value] of params.entries()) {
                qp[key] = value;
              }
              logInfo('Parsed from hash: ' + JSON.stringify(qp));
            }
            
            isValid = qp.state === sentState;
            logInfo('isValid: ' + isValid);
            logInfo('Found code: ' + (qp.code ? 'YES' : 'NO'));

            if (oauth2.auth.schema.get("flow") === "accessCode" || 
                oauth2.auth.schema.get("flow") === "authorizationCode" || 
                oauth2.auth.schema.get("flow") === "authorization_code") {
              logInfo('Flow type: ' + oauth2.auth.schema.get("flow"));
              
              if (!isValid) {
                logInfo('WARNING: State mismatch');
                oauth2.errCb({
                  authId: oauth2.auth.name,
                  source: "auth",
                  level: "warning",
                  message: "Authorization may be unsafe, passed state was changed in server. The passed state wasn't returned from auth server."
                });
              }

              if (qp.code) {
                logInfo('Processing code: ' + qp.code);
                delete oauth2.state;
                oauth2.auth.code = qp.code;
                oauth2.callback({auth: oauth2.auth, redirectUrl: redirectUrl});
              } else {
                let oauthErrorMsg;
                if (qp.error) {
                  oauthErrorMsg = "["+qp.error+"]: " +
                    (qp.error_description ? qp.error_description+ ". " : "no accessCode received from the server. ") +
                    (qp.error_uri ? "More info: "+qp.error_uri : "");
                }
                
                logInfo('Error: ' + (oauthErrorMsg || "[Authorization failed]: no accessCode received from the server."));
                oauth2.errCb({
                  authId: oauth2.auth.name,
                  source: "auth",
                  level: "error",
                  message: oauthErrorMsg || "[Authorization failed]: no accessCode received from the server."
                });
              }
            } else {
              logInfo('Flow type: ' + oauth2.auth.schema.get("flow") + ' (implicit)');
              oauth2.callback({auth: oauth2.auth, token: qp, isValid: isValid, redirectUrl: redirectUrl});
            }
            
            logInfo('Processing complete, closing window in 10 seconds...');
            setTimeout(function() {
              window.close();
            }, 10000);
            
          } catch (e) {
            debugInfo.innerHTML += 'Error: ' + e.message + '\\n' + e.stack + '\\n';
          }
        }

        if (document.readyState !== 'loading') {
          run();
        } else {
          document.addEventListener('DOMContentLoaded', function () {
            run();
          });
        }
      </script>
      </body>
      </html>
    `)
  })
}

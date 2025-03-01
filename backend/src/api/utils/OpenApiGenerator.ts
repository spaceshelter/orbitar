import { Application } from 'express'

import { ExpressOauth2ScopesFilter } from '../OAuth2Middleware'
import { extractRouteInfo, RouteInfo } from './express-reflection'

/**
 * Helper function to safely get typed properties from unknown types
 * @param obj The object to get the property from
 * @param key The key of the property to get
 * @param defaultValue Optional default value to return if the property is not found
 * @returns The property value or the default value
 */
export function safeGet<T = unknown>(obj: unknown, key: string | number, defaultValue?: T): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return defaultValue
  }

  // Check if the key exists in the object
  if (key in (obj as Record<string | number, unknown>)) {
    return (obj as Record<string | number, unknown>)[key] as T
  }

  return defaultValue
}

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

/**
 * Interface for Joi rule
 */
interface JoiRule {
  name: string
  args?: {
    limit?: number
    regex?: RegExp
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Interface for Joi description
 */
interface JoiDescription {
  type: string
  keys?: Record<string, JoiDescription>
  items?: JoiDescription[]
  rules?: JoiRule[]
  patterns?: Array<{
    key: string
    rule: {
      name: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }>
  matches?: Array<{
    schema: JoiDescription
    [key: string]: unknown
  }>
  flags?: {
    description?: string
    default?: unknown
    [key: string]: unknown
  }
  allow?: unknown[]
  [key: string]: unknown
}

/**
 * Interface for schema with describe method
 */
interface SchemaWithDescribe {
  describe: () => JoiDescription
  [key: string]: unknown
}

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
          url: 'https://api.orbitar.space/api/v1',
          description: 'Production API Server',
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
                authorizationUrl: 'https://orbitar.space/oauth2/authorize',
                tokenUrl: 'https://api.orbitar.space/api/v1/oauth2/token',
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
    return ExpressOauth2ScopesFilter.pathToScopesList(path)
  }

  /**
   * Convert Joi schema to OpenAPI schema
   * Note: This is a simplified implementation that handles common Joi types
   */
  private joiSchemaToOpenApi(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object' }
    }

    // Check if schema has describe method
    const schemaWithDescribe = schema as Partial<SchemaWithDescribe>
    if (typeof schemaWithDescribe.describe !== 'function') {
      return { type: 'object' }
    }

    try {
      const description = schemaWithDescribe.describe()
      return this.convertJoiDescription(description)
    } catch (error) {
      console.error('Failed to convert Joi schema', error)
      return { type: 'object' }
    }
  }

  private convertJoiDescription(descriptionObj: unknown): Record<string, unknown> {
    // Type guard to ensure the description is an object with the expected properties
    if (!descriptionObj || typeof descriptionObj !== 'object') {
      return { type: 'object' }
    }

    const description = descriptionObj as JoiDescription
    const result: Record<string, unknown> = {}

    // Handle type
    switch (description.type) {
      case 'object':
        result.type = 'object'
        result.properties = {}

        if (description.keys) {
          Object.entries(description.keys).forEach(([key, value]) => {
            ;(result.properties as Record<string, unknown>)[key] = this.convertJoiDescription(value)
          })
        }

        // Required properties
        if (description.patterns && Array.isArray(description.patterns)) {
          description.patterns.forEach((pattern) => {
            if (pattern.rule && pattern.rule.name === 'required') {
              if (!result.required) {
                result.required = []
              }
              ;(result.required as string[]).push(pattern.key)
            }
          })
        }
        break

      case 'array':
        result.type = 'array'
        if (description.items && Array.isArray(description.items) && description.items.length > 0) {
          result.items = this.convertJoiDescription(description.items[0])
        }
        break

      case 'string':
        result.type = 'string'
        // Handle string formats
        if (description.rules && Array.isArray(description.rules)) {
          description.rules.forEach((rule) => {
            if (rule.name === 'email') {
              result.format = 'email'
            } else if (rule.name === 'uri') {
              result.format = 'uri'
            } else if (rule.name === 'min' && rule.args?.limit !== undefined) {
              result.minLength = rule.args.limit
            } else if (rule.name === 'max' && rule.args?.limit !== undefined) {
              result.maxLength = rule.args.limit
            } else if (rule.name === 'pattern' && rule.args?.regex) {
              result.pattern = rule.args.regex.toString().slice(1, -1)
            }
          })
        }
        break

      case 'number':
      case 'integer':
        result.type = description.type
        // Handle number constraints
        if (description.rules && Array.isArray(description.rules)) {
          description.rules.forEach((rule) => {
            if (rule.name === 'min' && rule.args?.limit !== undefined) {
              result.minimum = rule.args.limit
            } else if (rule.name === 'max' && rule.args?.limit !== undefined) {
              result.maximum = rule.args.limit
            } else if (rule.name === 'greater' && rule.args?.limit !== undefined) {
              result.exclusiveMinimum = rule.args.limit
            } else if (rule.name === 'less' && rule.args?.limit !== undefined) {
              result.exclusiveMaximum = rule.args.limit
            }
          })
        }
        break

      case 'boolean':
        result.type = 'boolean'
        break

      case 'date':
        result.type = 'string'
        result.format = 'date-time'
        break

      case 'alternatives':
        // For alternatives (anyOf in OpenAPI), we need to handle each type
        if (description.matches && Array.isArray(description.matches) && description.matches.length > 0) {
          result.anyOf = description.matches.map((match) => this.convertJoiDescription(match.schema))
        }
        break

      default:
        result.type = 'string'
    }

    // Add description if present
    if (description.flags?.description) {
      result.description = description.flags.description
    }

    // Add default value if present
    if (description.flags?.default !== undefined) {
      result.default = description.flags.default
    }

    // Handle enum values
    if (description.allow && Array.isArray(description.allow)) {
      const validValues = description.allow.filter((value) => value !== null)
      if (validValues.length > 0) {
        result.enum = validValues
      }
    }

    return result
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
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Orbitar API Documentation</title>
          <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css">
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
          <script>
            window.onload = function() {
              window.ui = SwaggerUIBundle({
                url: "/api/v1/docs/openapi.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                oauth2RedirectUrl: window.location.origin + "/api/v1/docs/oauth2-redirect.html"
              });
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
      </head>
      <body>
      <script>
        'use strict';
        function run () {
          var oauth2 = window.opener.swaggerUIRedirectOauth2;
          var sentState = oauth2.state;
          var redirectUrl = oauth2.redirectUrl;
          var isValid, qp, arr;

          if (/code|token|error/.test(window.location.hash)) {
            qp = window.location.hash.substring(1);
          } else {
            qp = location.search.substring(1);
          }

          arr = qp.split("&");
          arr.forEach(function (v,i,_arr) { _arr[i] = '"' + v.replace('=', '":"') + '"';});
          qp = qp ? JSON.parse('{' + arr.join() + '}',
                  function (key, value) {
                      return key === "" ? value : decodeURIComponent(value);
                  }
          ) : {};

          isValid = qp.state === sentState;

          if (oauth2.auth.schema.get("flow") === "accessCode" && !oauth2.auth.code) {
              if (!isValid) {
                  oauth2.errCb({
                      authId: oauth2.auth.name,
                      source: "auth",
                      level: "warning",
                      message: "Authorization may be unsafe, passed state was changed in server. The passed state wasn't returned from auth server."
                  });
              }

              if (qp.code) {
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

                  oauth2.errCb({
                      authId: oauth2.auth.name,
                      source: "auth",
                      level: "error",
                      message: oauthErrorMsg || "[Authorization failed]: no accessCode received from the server."
                  });
              }
          } else {
              oauth2.callback({auth: oauth2.auth, token: qp, isValid: isValid, redirectUrl: redirectUrl});
          }
          window.close();
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

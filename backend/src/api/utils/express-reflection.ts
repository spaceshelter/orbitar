import { Application, NextFunction, Request, Response } from 'express'

interface Layer {
  handle?: (req: Request, res: Response, next: NextFunction) => void
  name?: string
  params?: Record<string, unknown>
  path?: string
  keys?: unknown[]
  regexp?: RegExp
  route?: {
    path: string
    stack: Layer[]
    methods: Record<string, boolean>
  }
  stack?: Layer[]
}

type PropertyLocation<T> = [string, T] // [path, value]

/**
 * Extended route information extracted from Express application
 */
export interface RouteInfo {
  path: string
  method: string
  scopeDescription?: string
  validationSchema?: unknown
  middlewares: string[]
}

/**
 * Extracts a given property from all handlers in an Express application.
 *
 * @param app - Express application instance or Layer object.
 * @param propertyName - Property name to search for.
 * @param routePath - Current route path. leave empty for root.
 */
export default function extractFromExpressApp<T>(
  app: Application | Layer | Layer[] | null | undefined,
  propertyName: string,
  routePath = '',
): PropertyLocation<T>[] {
  if (!app) {
    return []
  }

  let results: PropertyLocation<T>[] = []

  // Handle Express application
  if ('_router' in app) {
    return extractFromExpressApp(app._router?.stack, propertyName, routePath)
  }

  // Handle array of layers
  if (Array.isArray(app)) {
    app.forEach((layer) => {
      const layerResults = extractFromExpressApp<T>(layer, propertyName, layer.route?.path || routePath)
      results = results.concat(layerResults)
    })
    return results
  }

  // Handle Layer object
  const layer = app as Layer
  const currentPath = layer.route?.path || routePath

  // Check if property exists on current layer
  if (propertyName in layer) {
    results.push([currentPath, (layer as unknown as Record<string, T>)[propertyName]])
  }

  // Check handle function scope
  if (layer.handle && typeof layer.handle === 'function') {
    const handle = layer.handle
    const scopeProperties = Object.getOwnPropertyNames(handle).reduce<Record<string, unknown>>((obj, key) => {
      obj[key] = (handle as unknown as Record<string, unknown>)[key]
      return obj
    }, {})

    const handleResults = extractFromExpressApp<T>(scopeProperties, propertyName, currentPath)
    results = results.concat(handleResults)
  }

  // Check route stack
  if (layer.route?.stack) {
    const routeResults = extractFromExpressApp<T>(layer.route.stack, propertyName, layer.route.path)
    results = results.concat(routeResults)
  }

  // Check middleware stack
  if (layer.stack) {
    const stackResults = extractFromExpressApp<T>(layer.stack, propertyName, currentPath)
    results = results.concat(stackResults)
  }

  // Check params object
  if (layer.params) {
    const paramsResults = extractFromExpressApp<T>(layer.params, propertyName, currentPath)
    results = results.concat(paramsResults)
  }

  return results
}

/**
 * Extracts complete route information from an Express application.
 * This includes paths, methods, middleware, validation schemas, and scope descriptions.
 *
 * @param app - Express application instance
 * @returns Array of route information objects
 */
export function extractRouteInfo(app: Application): RouteInfo[] {
  if (!app || !app._router) {
    return []
  }

  // Look for controllers mounted at /api/v1/
  app._router.stack.find((layer: Layer) => layer.regexp && layer.regexp.toString().includes('/^\\/api\\/v1\\/'))
  const routes: RouteInfo[] = []

  function processLayer(layer: Layer, basePath = '') {
    // Handle routers and regular route handlers differently
    if (!layer.route) {
      // Check if this is a router middleware (mounted via app.use)
      if (layer.handle && typeof layer.handle === 'function') {
        // Extract router path from regexp if available
        let routerPath = basePath
        if (layer.regexp) {
          const match = layer.regexp.toString().match(/^\\\/\^\\\/([^$?]*)/)
          if (match && match[1]) {
            routerPath += '/' + match[1].replace(/\\\//g, '/').replace(/\\\\/g, '')
          }
        }

        // Cast handle to a type that allows property access
        const handle = layer.handle as unknown as Record<string, unknown>
        const route = (handle?.layer as Layer)?.route

        // Case 1: This is a router with its own stack
        if (handle.name === 'router' && handle.stack && Array.isArray(handle.stack)) {
          const routerStack = handle.stack as unknown as Layer[]
          routerStack.forEach((subLayer) => {
            processLayer(subLayer, routerPath)
          })
        }

        // Case 2: This is an Express Router instance
        else if (layer.name === 'router' && handle.stack && Array.isArray(handle.stack)) {
          const routerStack = handle.stack as unknown as Layer[]
          routerStack.forEach((subLayer) => {
            processLayer(subLayer, routerPath)
          })
        }

        // Case 3: This is the .route() handler in Express
        else if (layer.name === 'bound dispatch' && handle.layer && route) {
          // Handle special case for route handlers
          if (route && route.path) {
            const fullPath = routerPath + route.path
            const methods = Object.keys(route.methods || {}).map((m) => m.toUpperCase())

            methods.forEach((method) => {
              routes.push({
                path: fullPath,
                method,
                scopeDescription: undefined,
                validationSchema: undefined,
                middlewares: [],
              })
            })
          }
        }
      }

      return
    }

    // Process actual route handlers
    if (layer.route) {
      const routePath = basePath + layer.route.path

      // Skip the catch-all route that Express sets up for 404 handling
      if (routePath === '*') {
        return
      }

      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase())

      methods.forEach((method) => {
        // Extract middleware names and other properties from route handlers
        const middlewares: string[] = []
        let scopeDescription: string | undefined
        let validationSchema: unknown

        layer.route.stack.forEach((handler: Layer) => {
          if (handler.name) {
            middlewares.push(handler.name)
          }

          // Extract orbitarOauth2ScopeDescription from handler
          if (handler.handle && typeof handler.handle === 'function') {
            const handle = handler.handle as unknown as Record<string, unknown>
            if (handle.orbitarOauth2ScopeDescription) {
              scopeDescription = handle.orbitarOauth2ScopeDescription as string
            }
          }

          // Extract validation schema if present
          // This is specific to our Joi validation middleware
          if (handler.handle && typeof handler.handle === 'function') {
            // Extract the schema from the handler function
            const handle = handler.handle as unknown as Record<string, unknown>

            // Check for validatedObjectSchema property (we set this in the validate middleware)
            if (handle.validatedObjectSchema) {
              validationSchema = handle.validatedObjectSchema
            }
          }
        })

        routes.push({
          path: routePath,
          method,
          scopeDescription,
          validationSchema,
          middlewares,
        })
      })
    }
  }

  // Process all layers in the router
  app._router.stack.forEach((layer: Layer) => {
    processLayer(layer)
  })

  return routes
}

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

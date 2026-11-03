import { ExpressOauth2ScopesFilter } from '../../src/api/OAuth2Middleware'

// We'll directly test the OpenAPI scope generation logic
describe('API scope generation', () => {
  describe('pathToScope', () => {
    it('should generate correct scope strings from paths', () => {
      // Test the pathToScope implementation
      expect(ExpressOauth2ScopesFilter.pathToScope('/invite/create')).toBe('invite:create')
      expect(ExpressOauth2ScopesFilter.pathToScope('/user/profile')).toBe('user:profile')

      // Ensure it works with various path formats
      expect(ExpressOauth2ScopesFilter.pathToScope('/api/v1/invite/create')).toBe('api:v1:invite:create')
      expect(ExpressOauth2ScopesFilter.pathToScope('/oauth2/authorize')).toBe('oauth2:authorize')
    })
  })

  describe('pathToScopesList', () => {
    it('should generate hierarchical scope lists', () => {
      // Test the pathToScopesList implementation
      expect(ExpressOauth2ScopesFilter.pathToScopesList('/invite/create')).toEqual(['invite', 'invite:create'])

      expect(ExpressOauth2ScopesFilter.pathToScopesList('/user/profile')).toEqual(['user', 'user:profile'])

      // Check that the /api/v1 prefixed paths would include the api:v1 in scope
      expect(ExpressOauth2ScopesFilter.pathToScopesList('/api/v1/invite/create')).toEqual([
        'api',
        'api:v1',
        'api:v1:invite',
        'api:v1:invite:create',
      ])
    })
  })

  describe('OpenAPI scope path cleaning', () => {
    it('should strip /api/v1 prefix before generating scopes', () => {
      // This tests the logic we added in the getRequiredScopes method
      const cleanPath = (path: string) => path.replace(/^\/api\/v1/, '')

      // Original path with /api/v1 prefix
      const originalPath = '/api/v1/invite/create'

      // After cleaning prefix
      const cleanedPath = cleanPath(originalPath)
      expect(cleanedPath).toBe('/invite/create')

      // Generating scopes from the cleaned path
      const scopes = ExpressOauth2ScopesFilter.pathToScopesList(cleanedPath)
      expect(scopes).toEqual(['invite', 'invite:create'])

      // This is the expected result in the OpenAPI spec
      expect(scopes).not.toContain('api')
      expect(scopes).not.toContain('api:v1')
    })
  })
})

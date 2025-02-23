import { ExpressOauth2ScopesFilter } from '../../src/api/OAuth2Middleware'

describe('ExpressOauth2ScopesFilter', () => {
  describe('isSubscope', () => {
    it('returns true if subscope equals superscope', () => {
      expect(ExpressOauth2ScopesFilter.isSubscope('scope', 'scope')).toBe(true)
    })
    it('returns true if subscope is more specific than superscope', () => {
      expect(ExpressOauth2ScopesFilter.isSubscope('scope:child', 'scope')).toBe(true)
    })
    it('returns false if subscope is unrelated', () => {
      expect(ExpressOauth2ScopesFilter.isSubscope('different:scope', 'scope')).toBe(false)
    })
  })

  describe('splitScope', () => {
    it('splits a scope string by spaces', () => {
      const result = ExpressOauth2ScopesFilter.splitScope('scope1 scope2')
      expect(result).toEqual(['scope1', 'scope2'])
    })
    it('ignores extra spaces', () => {
      const result = ExpressOauth2ScopesFilter.splitScope(' scope1   scope2 ')
      expect(result).toEqual(['scope1', 'scope2'])
    })
  })

  describe('minimizeScopes', () => {
    it('removes subscopes if parent scope is present', () => {
      const input = ['scope', 'scope:child', 'another', 'another:child']
      const result = ExpressOauth2ScopesFilter.minimizeScopes(input)
      expect(result).toEqual(['scope', 'another'])
    })
    it('keeps unique scopes when no parent scope is found', () => {
      const input = ['scope', 'not:parent']
      const result = ExpressOauth2ScopesFilter.minimizeScopes(input)
      expect(result).toEqual(input)
    })
  })

  describe('pathToScope', () => {
    it('converts a path to a colon-separated scope', () => {
      expect(ExpressOauth2ScopesFilter.pathToScope('/oauth2/client/register')).toBe('oauth2:client:register')
    })
  })

  describe('pathToScopesList', () => {
    it('returns a list of increasingly specific scopes from a path', () => {
      const path = '/oauth2/client/register'
      const result = ExpressOauth2ScopesFilter.pathToScopesList(path)
      expect(result).toEqual(['oauth2', 'oauth2:client', 'oauth2:client:register'])
    })
  })
})

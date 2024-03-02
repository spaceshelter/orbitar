import TokenService from '../../src/oauth/TokenService';

describe('TokenService', () => {
  test('isRefreshTokenValid should return false if the token is invalid', () => {
    const refreshToken = TokenService.generateRefreshToken();
    const isValid = TokenService.isRefreshTokenValid(refreshToken, 'invalid-token');
    expect(isValid).toBe(false);
  });

  test('getAccessTokenExpiry should return a valid date', () => {
    const expiryDate = TokenService.getAccessTokenExpiry();
    expect(expiryDate instanceof Date).toBe(true);
  });

  test('getAccessTokenExpiry should return a date in the future', () => {
    const expiryDate = TokenService.getAccessTokenExpiry();
    expect(expiryDate > new Date()).toBe(true);
  });
});

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const accessTokenExpiresInHours = 24;

export default class TokenService {
  static getSecretKey(): string {
    return process.env.JWT_SECRET_KEY;
  }

  static generateAccessToken(sub: string, name: string, aud: string, scope: string, exp: number, iat: number, authTime: number): string {
    const payload = {
      iss: process.env.JWT_ISSUER || 'https://orbitar.space',
      sub,
      name,
      aud,
      exp,
      iat,
      auth_time: authTime,
      scope
    };

    const secretKey = TokenService.getSecretKey();
    return jwt.sign(payload, secretKey);
  }

  static generateRefreshToken(): string {
    return crypto.randomBytes(60).toString('hex');
  }

  static isRefreshTokenValid(storedTokenData, receivedToken): boolean {
    return storedTokenData.token === receivedToken && storedTokenData.expiresIn > new Date();
  }

  static getAccessTokenExpiry(): Date {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + accessTokenExpiresInHours);
    return expiryDate;
  }

  static generateClientId = (): string => {
    return crypto.randomUUID();
  };

  static generateClientSecret = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  static hashString = (value: string): string => {
    return crypto.createHash('sha256').update(value).digest('hex');
  };

  static generateAuthorizationCode(ttlSeconds: number): { code: string; expiresAt: Date } {
    return {
      code: crypto.randomBytes(16).toString('hex'),
      expiresAt: new Date(Date.now() + (ttlSeconds) * 1000)
    };
  }
}

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const accessTokenExpiresInHours = 24;

export enum TokenType {
  Access,
  Refresh
}

export default class TokenService {
  static getSecretKey(): string {
    return process.env.JWT_SECRET_KEY;
  }

  static generateJwtToken(sub: string, exp: number, iat: number, aud: string, scope: string | string[], type: TokenType): string {
    const iss = 'https://orbitar.space';
    scope = Array.isArray(scope) ? scope.join(' ') : scope;
    const payload = {
      aud,
      iss,
      exp,
      iat,
      sub,
      scope,
      type
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
}

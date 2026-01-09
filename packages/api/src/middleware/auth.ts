/**
 * Auth Middleware
 *
 * JWT verification for protected routes.
 * Uses jose for edge-compatible JWT handling.
 */

import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import * as jose from 'jose';
import type { Env } from '../db/client.js';

export type AuthUser = {
  userId: string;
  email: string;
  deviceId?: string;
};

/**
 * Middleware that verifies JWT and adds user to context
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    if (!payload.sub || !payload.email) {
      throw new HTTPException(401, { message: 'Invalid token payload' });
    }

    c.set('user', {
      userId: payload.sub,
      email: payload.email as string,
      deviceId: payload.deviceId as string | undefined,
    });

    await next();
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new HTTPException(401, { message: 'Token expired' });
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new HTTPException(401, { message: 'Invalid token' });
    }
    throw new HTTPException(401, { message: 'Authentication failed' });
  }
});

/**
 * Create JWT tokens for user
 */
export async function createTokens(
  secret: string,
  user: { id: string; email: string },
  deviceId?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const secretKey = new TextEncoder().encode(secret);

  // Access token - short lived (15 minutes)
  const accessToken = await new jose.SignJWT({
    email: user.email,
    deviceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey);

  // Refresh token - longer lived (7 days)
  const refreshToken = await new jose.SignJWT({
    email: user.email,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);

  return { accessToken, refreshToken };
}

/**
 * Verify refresh token and return user ID
 */
export async function verifyRefreshToken(
  secret: string,
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    if (payload.type !== 'refresh' || !payload.sub || !payload.email) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtParams } from '../interfaces/jwt-params';

/**
 * How long a session lives. One value, because the JWT and the cookie carrying it must expire
 * together: a token that outlives its cookie buys the member nothing (nothing client-side reads
 * the TTL) and only widens the window in which a captured token can be replayed.
 */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * Single definition of the `anash_token` cookie.
 *
 * Shared because two controllers now mint tokens: `login` in auth-controller, and `updateUser`
 * in user-controller, which must re-issue the cookie the moment a member sets their first
 * password (their old token still says `pwVerified: false`).
 */
export function setAuthCookie(res: Response, token: string): void {
    res.cookie('anash_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_TTL_SECONDS * 1000,
    });
}

/**
 * Mint a session: sign the token and set the cookie in one step.
 *
 * A shared constant alone would not hold the invariant -- a caller could still pass its own
 * `expiresIn`. This is the only mint path that signs and sets together, so as long as every
 * caller uses it the two lifetimes agree. It is a convention, not an enforcement: `setAuthCookie`
 * remains exported and will still write a cookie around any pre-signed token handed to it.
 *
 * `secret` is a parameter rather than read here so this helper does not take a position on where
 * the secret comes from; today both callers pass `process.env.JWT_SECRET!` directly.
 */
export function issueAuthToken(res: Response, params: JwtParams, secret: string): void {
    setAuthCookie(res, jwt.sign(params, secret, { expiresIn: SESSION_TTL_SECONDS }));
}

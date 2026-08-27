/* global process */
import type { Response } from 'express';

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
        maxAge: 8 * 60 * 60 * 1000,
    });
}

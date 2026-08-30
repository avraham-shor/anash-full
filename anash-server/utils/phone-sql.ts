import { sql, or, like } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from '../db/schema.ts';

/**
 * SQL-side counterpart to `utils/phone.ts`, which stays free of drizzle so it can be unit-tested
 * as plain string code. Everything here builds predicates and touches no database: `db/schema.ts`
 * imports only `drizzle-orm/pg-core`, never `db.ts`, so these can be rendered to SQL in a test
 * without opening a connection.
 */

// Stored numbers carry any mix of separators ("053-540 7761", "(054)632.9221") and may or may
// not carry a country code, so any comparison against a phone column runs over a digits-only
// projection of it rather than over the raw text.
export const digitsOnly = (column: AnyPgColumn) => sql`regexp_replace(${column}, '[^0-9]', '', 'g')`;

/**
 * Substring match of a search term against every phone column the directory search covers.
 *
 * `needle` must come from `phoneSearchNeedle`, which guarantees digits only -- that is what keeps
 * `%` and `_` out of the pattern. The term itself travels as a bound parameter, never interpolated.
 *
 * Throws on an empty needle rather than silently building `LIKE '%%'` -- an empty pattern matches
 * every row in every column, which is the exact whole-directory leak this module exists to close.
 * A caller that forgot to check `phoneSearchNeedle`'s result first gets a loud failure, not a leak.
 */
export const phoneSearchCondition = (needle: string) => {
    if (!needle) {
        throw new Error('phoneSearchCondition requires a non-empty needle; check phoneSearchNeedle\'s result first');
    }
    const p = `%${needle}%`;
    return or(
        like(digitsOnly(users.homePhone), p),
        like(digitsOnly(users.husbandMobile), p),
        like(digitsOnly(users.wifeMobile), p),
        like(digitsOnly(users.whatsappNumber), p),
        like(digitsOnly(users.systemPhone1), p),
        like(digitsOnly(users.systemPhone2), p),
    );
};

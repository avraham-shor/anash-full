const IL_COUNTRY_CODE = /^(?:00972|\+?972)/;

/**
 * Normalizes a phone number to the local format stored in the DB:
 * "+972546329221" / "+972-54-632-9221" -> "0546329221".
 * Separators (spaces, dashes, parentheses, dots and RTL marks) are stripped.
 */
export function normalizePhone(phone: unknown): string {
    if (typeof phone !== 'string') return '';
    const cleaned = phone.replace(/[\s\-().\u200e\u200f]/g, '');
    if (!IL_COUNTRY_CODE.test(cleaned)) return cleaned;
    const local = cleaned.replace(IL_COUNTRY_CODE, '');
    return local.startsWith('0') ? local : `0${local}`;
}

/**
 * Every digits-only form a normalized Israeli number may be stored in.
 * "+972-54-632-9221" / "0546329221" -> [
 *   "0546329221", "546329221",
 *   "972546329221", "00972546329221",
 *   "9720546329221", "009720546329221",
 * ]
 *
 * Both the national form (no leading zero) and the local form (leading zero) are covered on
 * their own and behind each country-code prefix, because rows exist in all of those shapes --
 * including "972-054-632-9221", which keeps the country code AND the trunk zero.
 *
 * Callers compare these against a digits-only projection of the stored column, so parentheses,
 * dots, dashes and country-code prefixes all match the same row.
 * Returns [] for input that holds no usable digits.
 */
export function phoneMatchCandidates(phone: string): string[] {
    const digits = normalizePhone(phone).replace(/\D/g, '');
    const national = digits.startsWith('0') ? digits.slice(1) : digits;
    if (!national) return [];
    const local = `0${national}`;
    return [...new Set([
        local,
        national,
        `972${national}`,
        `00972${national}`,
        `972${local}`,
        `00972${local}`,
    ])];
}

/**
 * Guards the phone columns against input that is not a number at all.
 *
 * `normalizePhone` is a formatter, not a validator: it hands back "abc" untouched, and turns
 * "+972abc" into "0abc" -- which reduces to the single digit "0" and would otherwise be matched
 * against real rows. Callers must reject anything this returns false for before querying.
 */
export function isPlausiblePhone(normalized: string): boolean {
    return /^\d{7,15}$/.test(normalized);
}

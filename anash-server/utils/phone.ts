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

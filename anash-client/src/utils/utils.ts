export function getWhatsappUrl(phoneNumber: string | null): string {
    if (!phoneNumber) return '';
    const normalized = phoneNumber.replace(/\s/g, '').replace('-', '');
    if (normalized.startsWith('0')) {
        return `https://wa.me/+972${normalized.slice(1)}`;
    }
    if (normalized.startsWith('+')) {
        return `https://wa.me/${normalized}`;
    }
    return `https://wa.me/${normalized}`;
}
export function getWhatsappUrl(phoneNumber: string | null): string | null {
    console.log(`phoneNumber: ${phoneNumber}`);
    if (!phoneNumber) return null;
    if (phoneNumber.startsWith('0')) {
    console.log(`https://wa.me/+972${phoneNumber.slice(1)}`);
        return `https://wa.me/+972${phoneNumber.slice(1)}`;
    }
    return `https://wa.me/${phoneNumber}`;
}
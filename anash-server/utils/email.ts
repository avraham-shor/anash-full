import nodemailer from 'nodemailer';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

console.log('[SMTP] config:', {
    host:   process.env.SMTP_HOST,
    port:   process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user:   process.env.SMTP_USER,
    pass:   process.env.SMTP_PASS ? `${process.env.SMTP_PASS.slice(0, 3)}***` : '(not set)',
    from:   process.env.SMTP_FROM,
});

if (process.env.SMTP_HOST) {
    dns.resolve6(process.env.SMTP_HOST, (err, addrs) =>
        console.log('[SMTP] IPv6 addresses:', err?.message ?? addrs));
}

// Pre-resolve SMTP host to IPv4 to avoid Railway's IPv6-only egress.
// By connecting via IP directly we completely skip per-connection DNS lookup.
const transporterPromise = (async () => {
    const rawHost = process.env.SMTP_HOST ?? '';
    let host = rawHost;
    if (rawHost) {
        try {
            const addrs = await dns.promises.resolve4(rawHost);
            console.log('[SMTP] resolved', rawHost, '→ IPv4:', addrs);
            host = addrs[0];
        } catch (e: unknown) {
            console.warn('[SMTP] IPv4 resolve failed, using hostname:', (e as Error).message);
        }
    }
    const t = nodemailer.createTransport({
        host,
        port:   Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        // SNI must use the real hostname when connecting via bare IP address
        tls: host !== rawHost ? { servername: rawHost } : {},
    });
    t.verify().then(
        () => console.log('[SMTP] transporter ready, host:', host),
        (e: Error) => console.error('[SMTP] transporter verify failed:', e.message),
    );
    return t;
})();

export async function sendOtpEmail(to: string, code: string): Promise<void> {
    const t0 = Date.now();
    console.log('[SMTP] sending OTP to', to.replace(/(?<=.).(?=[^@]*@)/g, '*'));
    try {
        const transporter = await transporterPromise;
        const info = await transporter.sendMail({
            from:    process.env.SMTP_FROM,
            to,
            subject: 'קוד אימות לעדכון פרטים',
            text:    `קוד האימות שלך: ${code}\nתקף ל-15 דקות.`,
            html:    `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:400px">
  <h2>קוד אימות - רשימת אנ"ש</h2>
  <p>הקוד שלך לאימות זהות:</p>
  <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:20px;background:#F5F3FF;border-radius:8px;text-align:center">${code}</div>
  <p style="color:#9CA3AF;font-size:13px">הקוד תקף ל-15 דקות ולשימוש חד-פעמי.</p>
</div>`,
        });
        console.log('[SMTP] sent in', Date.now() - t0, 'ms, messageId:', info.messageId);
    } catch (err: unknown) {
        console.error('[SMTP] send failed after', Date.now() - t0, 'ms:', err);
        throw err;
    }
}

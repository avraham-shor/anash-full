import nodemailer from 'nodemailer';
import dns from 'dns';

// Railway has no IPv6 egress; prefer IPv4 to avoid ENETUNREACH on Gmail SMTP
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'קוד אימות לעדכון פרטים',
        text: `קוד האימות שלך: ${code}\nתקף ל-15 דקות.`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:400px">
  <h2>קוד אימות - רשימת אנ"ש</h2>
  <p>הקוד שלך לאימות זהות:</p>
  <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:20px;background:#F5F3FF;border-radius:8px;text-align:center">${code}</div>
  <p style="color:#9CA3AF;font-size:13px">הקוד תקף ל-15 דקות ולשימוש חד-פעמי.</p>
</div>`,
    });
}

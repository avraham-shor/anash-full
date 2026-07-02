import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(to: string, code: string): Promise<void> {
    const t0 = Date.now();
    console.log('[Email] sending OTP to', to.replace(/(?<=.).(?=[^@]*@)/g, '*'));
    const { data, error } = await resend.emails.send({
        from:    process.env.RESEND_FROM ?? 'Anash <noreply@anash-list.com>',
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
    if (error) {
        console.error('[Email] send failed after', Date.now() - t0, 'ms:', error);
        throw new Error(error.message);
    }
    console.log('[Email] sent in', Date.now() - t0, 'ms, id:', data?.id);
}

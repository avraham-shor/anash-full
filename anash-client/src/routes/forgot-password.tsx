import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import { FORGOT_PASSWORD_SEND_OTP_URL, FORGOT_PASSWORD_RESET_URL } from '../config';
import styles from './forgot-password.module.css';

type Step = 'phone' | 'otp' | 'newPassword';

export default function ForgotPassword() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const initialPhone = (location.state as { phone?: string } | null)?.phone ?? '';

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState(initialPhone);
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [noPassword, setNoPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSendOtp(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setNoPassword(false);
        setSubmitting(true);
        try {
            const res = await fetch(FORGOT_PASSWORD_SEND_OTP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.noPassword) setNoPassword(true);
                else setError(data.message || 'שגיאה בשליחת קוד');
                return;
            }
            setMaskedEmail(data.maskedEmail);
            setStep('otp');
        } catch {
            setError('שגיאת רשת, נסה שוב');
        } finally {
            setSubmitting(false);
        }
    }

    function handleOtpConfirm() {
        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            setError('יש להזין 6 ספרות');
            return;
        }
        setError('');
        setStep('newPassword');
    }

    async function handleReset(e: React.FormEvent) {
        e.preventDefault();
        if (newPassword.length < 4) {
            setError('הסיסמה חייבת להיות באורך 4 תווים לפחות');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('הסיסמאות אינן תואמות');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const res = await fetch(FORGOT_PASSWORD_RESET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message);
                if (res.status === 401) {
                    setOtp('');
                    setStep('otp');
                }
                return;
            }

            try {
                await login(phone, newPassword);
                navigate('/', { replace: true });
            } catch {
                navigate('/login');
            }
        } catch {
            setError('שגיאת רשת, נסה שוב');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.loginBrand}>
                    <div className={styles.loginBrandIcon}>🔑</div>
                    <h1 className={styles.loginTitle}>שחזור סיסמה</h1>
                    <p className={styles.loginSubtitle}>איפוס סיסמה באמצעות קוד לדוא&quot;ל</p>
                </div>

                {step === 'phone' && noPassword && (
                    <div className={styles.stepContent}>
                        <p className={styles.stepDesc}>
                            לחשבון זה אין סיסמה מוגדרת — ניתן להתחבר עם מספר הטלפון בלבד, ללא צורך בסיסמה
                        </p>
                        <button
                            className={styles.btnPrimary}
                            onClick={() => navigate('/login', { state: { phone } })}
                        >
                            כניסה עם מספר טלפון
                        </button>
                        <button className={styles.btnGhost} onClick={() => setNoPassword(false)}>
                            חזרה
                        </button>
                    </div>
                )}

                {step === 'phone' && !noPassword && (
                    <form onSubmit={handleSendOtp} className={styles.loginForm}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>מספר סלולרי</label>
                            <input
                                type="tel"
                                placeholder="050-000-0000"
                                className={styles.input}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                dir="ltr"
                                autoComplete="tel"
                                autoFocus
                            />
                        </div>

                        <p className={styles.formHint}>
                            נשלח קוד חד-פעמי לכתובת הדוא&quot;ל הרשומה בחשבון שלך
                        </p>

                        {error && <p className={styles.formError}>{error}</p>}

                        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                            {submitting ? 'שולח...' : 'שלח קוד איפוס'}
                        </button>
                        <button type="button" className={styles.btnGhost} onClick={() => navigate('/login')}>
                            חזרה להתחברות
                        </button>
                    </form>
                )}

                {step === 'otp' && (
                    <div className={styles.stepContent}>
                        <p className={styles.stepDesc}>
                            קוד אימות נשלח אל: <strong>{maskedEmail}</strong>
                        </p>
                        <p className={styles.stepHint}>הכנס את הקוד בן 6 הספרות</p>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            pattern="\d{6}"
                            className={styles.otpInput}
                            value={otp}
                            onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
                            autoFocus
                            dir="ltr"
                        />
                        {error && <p className={styles.formError}>{error}</p>}
                        <button
                            className={styles.btnPrimary}
                            onClick={handleOtpConfirm}
                            disabled={otp.length !== 6}
                        >
                            המשך
                        </button>
                        <button
                            className={styles.btnGhost}
                            onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                        >
                            שלח קוד מחדש
                        </button>
                    </div>
                )}

                {step === 'newPassword' && (
                    <form onSubmit={handleReset} className={styles.loginForm}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>סיסמה חדשה</label>
                            <input
                                type="password"
                                className={styles.input}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={4}
                                placeholder="לפחות 4 תווים"
                                dir="ltr"
                                autoComplete="new-password"
                                autoFocus
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>אימות סיסמה</label>
                            <input
                                type="password"
                                className={styles.input}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={4}
                                dir="ltr"
                                autoComplete="new-password"
                            />
                        </div>

                        {error && <p className={styles.formError}>{error}</p>}

                        <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                            {submitting ? 'שומר...' : 'אפס סיסמה'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

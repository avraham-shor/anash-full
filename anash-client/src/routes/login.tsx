import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import styles from './login.module.css';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(phone, password || undefined);
            navigate('/', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'שגיאה בהתחברות');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.loginBrand}>
                    <div className={styles.loginBrandIcon}>📖</div>
                    <h1 className={styles.loginTitle}>רשימת אנ&quot;ש</h1>
                    <p className={styles.loginSubtitle}>כניסה לרשימת הקהילה</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.loginForm}>
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
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            סיסמה <span className={styles.formOptional}>(אופציונלי)</span>
                        </label>
                        <input
                            type="password"
                            placeholder="הכנס סיסמה אם יש לך"
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            dir="ltr"
                            autoComplete="current-password"
                        />
                    </div>

                    <p className={styles.formHint}>
                        אם אין לך סיסמה — הכנס מספר סלולרי בלבד
                    </p>

                    {error && <p className={styles.formError}>{error}</p>}

                    <button
                        type="submit"
                        className={styles.btnPrimary}
                        disabled={loading}
                    >
                        {loading ? 'מתחבר...' : 'כניסה לרשימה'}
                    </button>
                </form>
            </div>
        </div>
    );
}

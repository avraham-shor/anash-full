import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { useAuth } from '../context/auth.tsx';
import { LOGIN_LOGS_URL } from '../config';
import styles from './login-logs.module.css';
import { Loader } from '../components/loader.tsx';

interface LoginLog {
    id: number;
    user_id: string;
    logged_in_at: string;
    ip_address: string | null;
    user_agent: string | null;
    success: boolean;
    full_name_search: string;
    city: string;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function truncate(str: string | null, len = 55) {
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function LoginLogs() {
    const { token, role } = useAuth();
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(LOGIN_LOGS_URL, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (!res.ok) throw new Error('שגיאה בטעינת הנתונים');
                return res.json();
            })
            .then(data => {
                setLogs(data);
                setLoading(false);
            })
            .catch(() => { setError('שגיאה בטעינת יומן הכניסות'); setLoading(false); });
    }, [token]);

    if (role !== 'owner') return <Navigate to="/" replace />;

    const total = logs.length;
    const successful = logs.filter(l => l.success).length;
    const failed = total - successful;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <Link to="/" className={styles.backLink}>← חזרה לדף הבית</Link>
                <h1 className={styles.pageTitle}>📊 יומן כניסות</h1>
                <p className={styles.pageSubtitle}>רשימת כל הכניסות של משתמשים למערכת</p>
            </div>

            {loading && <Loader />}

            {error && (
                <div className={styles.errorBox}>{error}</div>
            )}

            {!loading && !error && (
                <>
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <span className={styles.statNumber}>{total}</span>
                            <span className={styles.statLabel}>סה"כ כניסות</span>
                        </div>
                        <div className={`${styles.statCard} ${styles.statSuccess}`}>
                            <span className={styles.statNumber}>{successful}</span>
                            <span className={styles.statLabel}>כניסות מוצלחות</span>
                        </div>
                        <div className={`${styles.statCard} ${styles.statFail}`}>
                            <span className={styles.statNumber}>{failed}</span>
                            <span className={styles.statLabel}>כניסות כושלות</span>
                        </div>
                    </div>

                    <div className={styles.tableCard}>
                        {logs.length === 0 ? (
                            <div className={styles.centerState}>
                                <span className={styles.emptyIcon}>📋</span>
                                <p className={styles.stateText}>אין כניסות רשומות עדיין</p>
                            </div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>סטטוס</th>
                                            <th>שם</th>
                                            <th>עיר</th>
                                            <th>תאריך ושעה</th>
                                            <th>כתובת IP</th>
                                            <th>דפדפן</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id}>
                                                <td>
                                                    <span className={`${styles.badge} ${log.success ? styles.badgeSuccess : styles.badgeFail}`}>
                                                        {log.success ? '✓ הצלחה' : '✗ כשלון'}
                                                    </span>
                                                </td>
                                                <td className={styles.nameCell}>
                                                    <Link to={`/users/${log.user_id}`} className={styles.nameLink}>
                                                        {log.full_name_search}
                                                    </Link>
                                                </td>
                                                <td>{log.city || '—'}</td>
                                                <td className={styles.dateCell}>{formatDate(log.logged_in_at)}</td>
                                                <td className={styles.monoCell}>{log.ip_address || '—'}</td>
                                                <td className={styles.uaCell} title={log.user_agent ?? ''}>
                                                    {truncate(log.user_agent)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default LoginLogs;

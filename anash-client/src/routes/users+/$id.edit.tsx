import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../context/auth.tsx';
import { USERS_URL, SEND_OTP_URL, UPDATE_USER_URL } from '../../config';
import { Loader } from '../../components/loader.tsx';
import styles from './$id.edit.module.css';

type Step = 'loading' | 'send' | 'otp' | 'form';

type UserWithMeta = {
    id: string;
    hasPassword?: boolean;
    [key: string]: unknown;
};

const FIELD_LABELS: Record<string, string> = {
    salutation:         'כינוי',
    firstName:          'שם פרטי',
    lastName:           'שם משפחה',
    fatherName:         'שם האב',
    wifeName:           'שם האשה',
    wifeLastName:       'שם משפחה של האשה',
    wifeFatherName:     'שם אב האשה',
    wifeIdNumber:       'ת.ז. אשה',
    wifeBirthDate:      'תאריך לידה אשה',
    idNumber:           'תעודת זהות',
    birthDate:          'תאריך לידה',
    city:               'עיר',
    street:             'רחוב',
    buildingNumber:     'מספר בית',
    apartmentNumber:    'מספר דירה',
    entranceNumber:     'כניסה',
    neighborhood:       'שכונה',
    synagogue:          'בית כנסת',
    homePhone:          'טלפון בית',
    husbandMobile:      'נייד בעל',
    wifeMobile:         'נייד אשה',
    whatsappNumber:     'וואטסאפ',
    email1:             'דוא"ל',
    email2:             'דוא"ל נוסף',
    isGroomOfRabbi:     'חתן הרב',
    childrenAtHomeCount:'ילדים בבית',
    hasMarriedChildren: 'ילדים נשואים',
    husbandName:        'שם הבעל',
    husbandFatherName:  'שם אב הבעל',
    wantsToRegister:    'מעוניין להירשם',
};

const SECTIONS: { title: string; fields: string[] }[] = [
    { title: 'פרטים אישיים', fields: ['salutation', 'firstName', 'lastName', 'fatherName', 'idNumber', 'birthDate'] },
    { title: 'פרטי האשה', fields: ['wifeName', 'wifeLastName', 'wifeFatherName', 'wifeIdNumber', 'wifeBirthDate'] },
    { title: 'כתובת', fields: ['city', 'street', 'buildingNumber', 'apartmentNumber', 'entranceNumber', 'neighborhood'] },
    { title: 'טלפונים', fields: ['homePhone', 'husbandMobile', 'wifeMobile', 'whatsappNumber'] },
    { title: 'דוא"ל', fields: ['email1', 'email2'] },
    { title: 'קהילה', fields: ['synagogue', 'isGroomOfRabbi', 'childrenAtHomeCount', 'hasMarriedChildren'] },
    { title: 'פרטים נוספים', fields: ['husbandName', 'husbandFatherName', 'wantsToRegister'] },
];

export default function EditUser() {
    const { id } = useParams<{ id: string }>();
    const { id: myId, role } = useAuth();
    const navigate = useNavigate();

    const [user, setUser] = useState<UserWithMeta | null>(null);
    const [step, setStep] = useState<Step>('loading');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isOwner = role === 'owner';

    useEffect(() => {
        if (!id) return;
        if (myId !== id && !isOwner) {
            navigate(`/users/${id}`, { replace: true });
            return;
        }
        fetch(`${USERS_URL}${id}`, { credentials: 'include' })
            .then(r => r.json())
            .then((data: UserWithMeta) => {
                setUser(data);
                // Pre-fill form with all current values
                const initial: Record<string, string> = {};
                for (const field of Object.keys(FIELD_LABELS)) {
                    initial[field] = String(data[field] ?? '');
                }
                setFormData(initial);
                // Decide starting step
                if (data.hasPassword || isOwner) {
                    setStep('form');
                } else {
                    setStep('send');
                }
            });
    }, [id, myId, isOwner, navigate]);

    async function handleSendOtp() {
        setError('');
        setSubmitting(true);
        try {
            const res = await fetch(SEND_OTP_URL, { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) { setError(data.message); return; }
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
        setStep('form');
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!id) return;

        const needsPassword = !user?.hasPassword && !isOwner;
        if (needsPassword && (!newPassword || newPassword.length < 4)) {
            setError('חובה להגדיר סיסמה חדשה (לפחות 4 תווים)');
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const body: Record<string, string> = { ...formData };
            if (!isOwner && otp) body.otp = otp;
            if (newPassword) body.newPassword = newPassword;

            const res = await fetch(`${UPDATE_USER_URL}${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message);
                // If OTP error, send back to OTP step
                if (res.status === 401 && !user?.hasPassword) {
                    setOtp('');
                    setStep('otp');
                }
                return;
            }
            navigate(`/users/${id}`);
        } catch {
            setError('שגיאת רשת, נסה שוב');
        } finally {
            setSubmitting(false);
        }
    }

    if (step === 'loading') return <Loader />;

    return (
        <div className={styles.editPage}>
            <div className={styles.editCard}>
                <div className={styles.editHeader}>
                    <h1 className={styles.editTitle}>עדכון פרטים אישיים</h1>
                </div>

                {/* Step: Send OTP */}
                {step === 'send' && (
                    <div className={styles.stepContent}>
                        <p className={styles.stepDesc}>
                            לאימות זהותך, נשלח קוד חד-פעמי לכתובת הדוא"ל הרשומה בחשבון שלך.
                        </p>
                        {error && <p className={styles.formError}>{error}</p>}
                        <button
                            className={styles.btnPrimary}
                            onClick={handleSendOtp}
                            disabled={submitting}
                        >
                            {submitting ? 'שולח...' : 'שלח קוד אימות'}
                        </button>
                        <button className={styles.btnGhost} onClick={() => navigate(`/users/${id}`)}>
                            ביטול
                        </button>
                    </div>
                )}

                {/* Step: Enter OTP */}
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
                        <button className={styles.btnGhost} onClick={() => { setStep('send'); setError(''); }}>
                            שלח קוד מחדש
                        </button>
                    </div>
                )}

                {/* Step: Edit Form */}
                {step === 'form' && (
                    <form onSubmit={handleSave} className={styles.form}>
                        {SECTIONS.map(section => (
                            <div key={section.title} className={styles.section}>
                                <div className={styles.sectionTitle}>{section.title}</div>
                                <div className={styles.formGrid}>
                                    {section.fields.map(field => (
                                        <div key={field} className={styles.formGroup}>
                                            <label className={styles.formLabel}>{FIELD_LABELS[field]}</label>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                value={formData[field] ?? ''}
                                                onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Password section */}
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                {!user?.hasPassword && !isOwner ? 'הגדרת סיסמה (חובה)' : 'שינוי סיסמה'}
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    {!user?.hasPassword && !isOwner
                                        ? 'סיסמה חדשה *'
                                        : 'סיסמה חדשה (השאר ריק לשמור הנוכחית)'}
                                </label>
                                <input
                                    type="password"
                                    className={styles.input}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required={!user?.hasPassword && !isOwner}
                                    minLength={4}
                                    placeholder="לפחות 4 תווים"
                                    dir="ltr"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        {error && <p className={styles.formError}>{error}</p>}

                        <div className={styles.formActions}>
                            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                                {submitting ? 'שומר...' : 'שמור שינויים'}
                            </button>
                            <button
                                type="button"
                                className={styles.btnGhost}
                                onClick={() => navigate(`/users/${id}`)}
                                disabled={submitting}
                            >
                                ביטול
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

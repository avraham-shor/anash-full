import { createContext, useContext, useState, useEffect } from 'react';

/** The session roles a token can carry. `guest` exists only here, never in the users table. */
const ROLES = ['user', 'admin', 'owner', 'guest'] as const;

export type Role = typeof ROLES[number];

function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Anything the server did not name explicitly falls back to the least-privileged role. */
function toRole(value: unknown): Role {
    return isRole(value) ? value : 'guest';
}

interface UserProfile {
    id: string;
    name: string;
    role: Role;
    /** True only when the session proved the account password. */
    pwVerified?: boolean;
}

interface AuthContextType {
    isLoggedIn: boolean;
    id: string;
    role: Role;
    name: string;
    pwVerified: boolean;
    loading: boolean;
    login: (phone: string, password?: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(data => setUser(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const login = async (phone: string, password?: string) => {
        const body: Record<string, string> = { phone };
        if (password) body.password = password;

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'שגיאה בהתחברות');
        setUser(data.user);
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            isLoggedIn: !!user,
            id: user?.id || '',
            role: toRole(user?.role),
            name: user?.name || '',
            pwVerified: user?.pwVerified === true,
            loading,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

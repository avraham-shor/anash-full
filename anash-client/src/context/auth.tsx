import { createContext, useContext, useState } from 'react';
import { AUTH_URL } from '../config';

interface AuthContextType {
    token: string | null;
    id: string;
    role: 'user' | 'admin' | 'owner';
    name: string;
    login: (phone: string, password?: string) => Promise<void>;
    logout: () => void;
}

interface JwtTokenPayload {
    id?: string;
    name?: string;
    role?: 'user' | 'admin' | 'owner';
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodePayload(token: string | null): JwtTokenPayload {
    if (!token) return {};
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        return JSON.parse(json);
    } catch {
        return {};
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(() =>
        typeof window !== 'undefined' ? localStorage.getItem('anash_token') : null
    );

    const login = async (phone: string, password?: string) => {
        const body: Record<string, string> = { phone };
        if (password) body.password = password;

        const res = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'שגיאה בהתחברות');
        localStorage.setItem('anash_token', data.token);
        setToken(data.token);
    };

    const logout = () => {
        localStorage.removeItem('anash_token');
        setToken(null);
    };

    const decodedToken = decodePayload(token);

    return (
        <AuthContext.Provider value={{
            token,
            id: decodedToken.id || '',
            role: (decodedToken.role || 'user') as 'user' | 'admin' | 'owner',
            name: (decodedToken.name || ''),
            login,
            logout
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

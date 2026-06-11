import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../context/auth.tsx';

export default function ProtectedLayout() {
    const { token, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp < Date.now() / 1000) {
                    logout();
                    navigate('/login', { replace: true });
                }
            } catch {
                logout();
                navigate('/login', { replace: true });
            }
        } else {
            navigate('/login', { replace: true });
        }
    }, [token, navigate, logout]);

    if (!token) return null;

    return <Outlet />;
}

import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../context/auth.tsx';

export default function ProtectedLayout() {
    const { token, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (token) {
            const tokenExpaired = JSON.parse(token).expiry < Date.now() / 1000;
            if (tokenExpaired) {
                logout();
                navigate('/login', { replace: true });
            }
        }
        if (!token) {
            navigate('/login', { replace: true });
        }
    }, [token, navigate]);

    if (!token) return null;

    return <Outlet />;
}

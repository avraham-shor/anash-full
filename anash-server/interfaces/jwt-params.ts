export interface JwtParams {
    id: string;
    email?: string;
    name: string;
    role?: 'admin' | 'user' | 'owner';
}
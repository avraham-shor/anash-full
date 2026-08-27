export interface JwtParams {
    id: string;
    email?: string;
    name: string;
    role?: 'admin' | 'user' | 'owner' | 'guest';
    /**
     * True only after a successful bcrypt.compare against the account's password.
     * Absent or false means the caller never proved the password — deliberately
     * also the case for passwordless accounts, which the OTP gate covers instead.
     */
    pwVerified?: boolean;
}

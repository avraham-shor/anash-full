/**
 * Controller-level cover for the I/O & Edge-Case Matrix of
 * _bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md.
 *
 * RUN WITH:
 *   npm test
 *   (node --experimental-test-module-mocks --import tsx --test "**\/*.test.ts")
 *
 * The --experimental-test-module-mocks flag is required, and pins the suite to Node >=22.3
 * (see the engines field in package.json). These controllers import the live Postgres pool
 * through `../db.ts` at module scope, and the repo has neither dependency injection nor a test
 * framework to swap it out. `mock.module` is the only way to substitute a fake db without
 * connecting to the real Railway database, which holds real member data.
 *
 * ORDER OF OPERATIONS -- load-bearing:
 *   ESM hoists every static `import` above the statements written before it, so the env
 *   assignments below do NOT run before the static imports on the next lines. They do not need
 *   to: none of those modules read these vars. What matters is that the CONTROLLERS arrive via
 *   `await import(...)` further down, which executes after both the env assignments and the
 *   `mock.module` call. A static import of a controller would be hoisted above both and would
 *   load the real db and a keyless Resend client (`utils/email.ts` builds one at module scope
 *   and throws without a key). `dotenv` never overrides an already-set var, so these win.
 */
process.env.JWT_SECRET = 'test-secret-for-the-suite-only';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? 're_test_placeholder';

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Request, Response } from 'express';
import { getTableColumns } from 'drizzle-orm';
import { userLogins, users, verificationCodes } from './db/schema.ts';

type Row = Record<string, unknown> | undefined;

const state: {
    /** Row the `users` table yields for a normal (multi-column) read. */
    row: Row;
    /**
     * Rows the `users` table yields for a normal (multi-column) read, when a test needs more
     * than one -- e.g. an ambiguous phone match. Checked before `row`, so leaving this undefined
     * (the default) yields `row`'s single-row behavior exactly as before this field existed.
     */
    rows: Record<string, unknown>[] | undefined;
    /** Row the `users` table yields for the `{ password }`-only lookup. */
    passwordRow: Row;
    /** Rows the `verificationCodes` table yields -- the OTP path. */
    otpRows: Record<string, unknown>[];
    inserts: unknown[];
    updates: unknown[];
    selectShapes: (Record<string, unknown> | undefined)[];
    chain: string[];
    /** Calls to the mocked `sendOtpEmail` -- so a test can assert on an OTP email without a live Resend call. */
    emailsSent: { to: string; code: string }[];
} = {
    row: undefined, rows: undefined, passwordRow: undefined, otpRows: [],
    inserts: [], updates: [], selectShapes: [], chain: [], emailsSent: [],
};

function reset() {
    state.row = undefined;
    state.rows = undefined;
    state.passwordRow = undefined;
    state.otpRows = [];
    state.inserts = [];
    state.updates = [];
    state.selectShapes = [];
    state.chain = [];
    state.emailsSent = [];
}

/**
 * Minimal stand-in for a drizzle query builder.
 *
 * `from(table)` routes to the rows that table should yield, so a `verificationCodes` lookup no
 * longer returns the `users` fixture -- which is what makes the OTP success path testable.
 * Every other chain link returns itself and records its name, so a test can assert that a query
 * was ordered and limited.
 */
function builder(requested?: Record<string, unknown>) {
    let source: unknown[] = [];

    const project = (row: Record<string, unknown>, keys: string[] | null) =>
        keys === null ? row : Object.fromEntries(keys.filter(k => k in row).map(k => [k, row[k]]));

    const rowsForUsers = () => {
        const keys = requested ? Object.keys(requested) : null;
        const isPasswordLookup = keys !== null && keys.length === 1 && keys[0] === 'password';
        // state.rows (a multi-row fixture, e.g. an ambiguous phone match) takes priority over the
        // single-row state.row -- but never for the `{ password }`-only lookup, which no ambiguous-
        // match test drives and which every existing single-row test still exercises via passwordRow.
        if (!isPasswordLookup && state.rows) {
            return state.rows.map(row => project(row, keys));
        }
        const row = isPasswordLookup ? state.passwordRow : state.row;
        if (!row) return [];
        // Project, like the real driver does. A shaped select yields ONLY the requested columns,
        // so `!('password' in body)` is evidence about the shape rather than about the fixture; a
        // bare select() (keys === null) still yields the whole row, exactly as the unfixed admin
        // branch did, which is what makes that assertion fail if the fix is reverted.
        return [project(row, keys)];
    };

    const obj: Record<string, unknown> = {
        from: (table: unknown) => {
            state.chain.push('from');
            if (table === verificationCodes) source = state.otpRows;
            else if (table === userLogins) source = [];
            else source = rowsForUsers();
            return obj;
        },
        where: () => { state.chain.push('where'); return obj; },
        limit: () => { state.chain.push('limit'); return obj; },
        orderBy: () => { state.chain.push('orderBy'); return obj; },
        innerJoin: () => { state.chain.push('innerJoin'); return obj; },
        set: (values: unknown) => { state.updates.push(values); return obj; },
        values: (values: unknown) => { state.inserts.push(values); return obj; },
        // Awaiting the builder resolves to the routed rows, exactly as a drizzle query does.
        then(onFulfilled: unknown, onRejected: unknown) {
            return Promise.resolve(source).then(onFulfilled as never, onRejected as never);
        },
    };
    return obj;
}

mock.module('./db.ts', {
    defaultExport: {
        select: (cols?: Record<string, unknown>) => {
            state.selectShapes.push(cols);
            return builder(cols);
        },
        insert: (table: unknown) => builder().from(table) as Record<string, unknown>,
        update: (table: unknown) => builder().from(table) as Record<string, unknown>,
        delete: (table: unknown) => builder().from(table) as Record<string, unknown>,
    },
});

// utils/email.ts builds a real Resend client at module scope and would otherwise make a live
// network call the moment forgotPasswordSendOtp reaches its success path. Registered here, before
// the controller import below, for the same reason as the db.ts mock: ESM hoists static imports,
// so only a mock.module call that runs before the dynamic `await import(...)` of the controller
// can intercept what that controller transitively imports.
mock.module('./utils/email.ts', {
    namedExports: {
        sendOtpEmail: async (to: string, code: string) => {
            state.emailsSent.push({ to, code });
        },
    },
});

const { login, getMe, changeOwnPassword, matchesPhone, forgotPasswordSendOtp, resetPassword } =
    await import('./controllers/auth-controller.ts');
const { getUserById, getUsers, getUserByFullName, updateUser, sendEditOtp } =
    await import('./controllers/user-controller.ts');

function makeRes() {
    const out: {
        status: number;
        body: Record<string, unknown> | undefined;
        cookies: Record<string, string>;
    } = { status: 200, body: undefined, cookies: {} };
    const res = {
        status(code: number) { out.status = code; return res; },
        json(body: unknown) { out.body = body as Record<string, unknown>; return res; },
        cookie(name: string, value: string) { out.cookies[name] = value; return res; },
        clearCookie() { return res; },
    } as unknown as Response;
    return { res, out };
}

const req = (body: unknown, user?: unknown, params?: unknown, query?: unknown) =>
    ({
        body, user, params: params ?? {}, query: query ?? {},
        headers: {}, ip: '1.2.3.4',
    }) as unknown as Request;

const decodeCookie = (out: { cookies: Record<string, string> }) =>
    jwt.verify(out.cookies.anash_token, process.env.JWT_SECRET as string) as jwt.JwtPayload;

const LOCAL = '0546329221';
/** Every digits-only form phoneMatchCandidates emits, in order. */
const CANDIDATES = [
    '0546329221', '546329221',
    '972546329221', '00972546329221',
    '9720546329221', '009720546329221',
];
/** Columns a non-admin caller must never be able to select. */
const PII_COLUMNS = ['idNumber', 'wifeIdNumber', 'systemPhone1', 'systemPhone2', 'password', 'role'];

// --- Matrix row 1: international form matches any stored shape --------------------------------
// Asserted at the SQL level, on the predicate the controller actually ships, because the bug was
// in the SQL: the old cleanup stripped only '-' and ' ' from the column and compared one form.

test('row 1: matchesPhone reduces both phone columns to digits and binds every candidate form', () => {
    const predicate = matchesPhone('+972-54-632-9221');
    assert.ok(predicate, 'matchesPhone must produce a predicate');
    const { sql, params } = new PgDialect().sqlToQuery(predicate);

    assert.match(sql, /regexp_replace\("users"\."husband_mobile", '\[\^0-9\]', '', 'g'\) in \(\$1, \$2, \$3, \$4, \$5, \$6\)/);
    assert.match(sql, /regexp_replace\("users"\."wife_mobile", '\[\^0-9\]', '', 'g'\) in \(\$7, \$8, \$9, \$10, \$11, \$12\)/);
    assert.deepEqual(params, [...CANDIDATES, ...CANDIDATES]);

    // The bug being fixed: a column cleanup that removed only dashes and spaces.
    assert.doesNotMatch(sql, /replace\(replace\(/, 'the old separator-only cleanup must be gone');
    // Candidates travel as bound parameters, never interpolated into the statement.
    assert.doesNotMatch(sql, /0546329221/);
});

test('row 1: every submitted form renders the identical bound parameters', () => {
    const inputs = [
        '0546329221', '054-632-9221', '(054)632.9221', '546329221',
        '+972546329221', '+972-54-632-9221', '972546329221', '00972546329221',
        '972-054-632-9221', '00972-054-632-9221',
    ];
    for (const input of inputs) {
        const predicate = matchesPhone(input);
        assert.ok(predicate, `no predicate for ${input}`);
        const { params } = new PgDialect().sqlToQuery(predicate);
        assert.deepEqual(params, [...CANDIDATES, ...CANDIDATES], `unexpected params for ${input}`);
    }
    const stored = ['054 6329221', '(054)632.9221', '972546329221', '00972546329221',
        '546329221', '972-054-632-9221', '00972-054-632-9221'];
    for (const value of stored) {
        assert.ok(CANDIDATES.includes(value.replace(/\D/g, '')), `stored form ${value} is not covered`);
    }
});

test('login refuses input that is not a number instead of querying with it', async () => {
    // normalizePhone('abc') === 'abc' and normalizePhone('+972abc') === '0abc', which reduces to
    // the single digit '0' -- both used to reach the database.
    for (const bad of ['abc', '+972abc', '0', '12345', 'zzzzzzzzzzzzzzzzzzzz']) {
        reset();
        const { res, out } = makeRes();
        await login(req({ phone: bad }), res);
        assert.equal(out.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
        assert.equal(state.selectShapes.length, 0, `${JSON.stringify(bad)} must not reach the db`);
        assert.equal(out.cookies.anash_token, undefined, 'no session for invalid input');
    }
});

test('login resolves a multi-row match deterministically, not arbitrarily', async () => {
    reset();
    state.row = { id: 'u1', email1: 'a@b.co', fullName: 'ploni', password: null, role: null };
    const { res } = makeRes();
    await login(req({ phone: LOCAL }), res);

    // The widened digits-only predicate can match more than one row; without these, the account
    // the caller lands in is whatever Postgres happens to return first.
    assert.ok(state.chain.includes('orderBy'), 'the login select must be ordered');
    assert.ok(state.chain.includes('limit'), 'the login select must be limited');
});

// --- Matrix row 2: unknown number ------------------------------------------------------------

test('row 2: an unknown number is admitted as a guest and is never written to user_logins', async () => {
    reset();
    const { res, out } = makeRes();
    await login(req({ phone: '+972-99-999-9999' }), res);

    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { user: { id: '', name: '', role: 'guest', pwVerified: false } });
    assert.equal(state.inserts.length, 0, 'a guest attempt must not touch user_logins');

    const token = decodeCookie(out);
    assert.equal(token.role, 'guest');
    assert.equal(token.id, '');
    assert.equal(token.pwVerified, false);
});

// --- Matrix rows 3, 4 and 5: the password branches ---------------------------------------------

test('row 3/5: a held-back password still gets in, capped at user, and is logged as a success', async () => {
    reset();
    state.row = { id: 'u1', email1: 'a@b.co', fullName: 'ploni', password: '$2a$10$hash', role: 'owner' };
    const { res, out } = makeRes();
    await login(req({ phone: LOCAL }), res);

    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { user: { id: 'u1', name: 'ploni', role: 'user', pwVerified: false } });
    assert.equal(state.inserts.length, 1);
    assert.equal((state.inserts[0] as { success: boolean }).success, true);

    const token = decodeCookie(out);
    assert.equal(token.role, 'user', 'a privileged account is never elevated without its password');
    assert.equal(token.pwVerified, false);
});

test('row 4: a wrong password is still 401 and is logged as a failure', async () => {
    reset();
    state.row = {
        id: 'u1', email1: 'a@b.co', fullName: 'ploni',
        password: await bcrypt.hash('right', 4), role: 'owner',
    };
    const { res, out } = makeRes();
    await login(req({ phone: LOCAL, password: 'wrong' }), res);

    assert.equal(out.status, 401);
    assert.equal(out.body?.message, 'סיסמה שגויה');
    assert.equal(state.inserts.length, 1);
    assert.equal((state.inserts[0] as { success: boolean }).success, false);
    assert.equal(out.cookies.anash_token, undefined, 'a failed login must not set a cookie');
});

test('regression: a correct password still yields the real role and pwVerified', async () => {
    reset();
    state.row = {
        id: 'u1', email1: 'a@b.co', fullName: 'ploni',
        password: await bcrypt.hash('right', 4), role: 'owner',
    };
    const { res, out } = makeRes();
    await login(req({ phone: '+972-54-632-9221', password: 'right' }), res);

    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { user: { id: 'u1', name: 'ploni', role: 'owner', pwVerified: true } });
    const token = decodeCookie(out);
    assert.equal(token.role, 'owner');
    assert.equal(token.pwVerified, true);
});

// --- Select shaping: login and forgotPasswordSendOtp must not pull every users column ----------
// Both routes run unauthenticated. The bcrypt hash stays reachable -- bcrypt.compare and the
// !row.password branch both need it -- but nothing else should ride along. The mock projects a
// shaped select down to its requested keys, so a reverted bare select() hands back the whole
// fixture and fails the "keys equal the expected set" assertion below.

/** Columns neither narrowed read may select -- PII and coordinates no unauthenticated branch reads. */
const EXCLUDED_FROM_NARROW_READS = ['idNumber', 'wifeIdNumber', 'systemPhone1', 'systemPhone2', 'coordinates'];

test('login asks for exactly the columns its branches read, not the whole row', async () => {
    reset();
    state.row = {
        id: 'u1', email1: 'a@b.co', fullName: 'ploni',
        password: await bcrypt.hash('right', 4), role: 'owner',
    };
    const { res, out } = makeRes();
    await login(req({ phone: LOCAL, password: 'right' }), res);

    assert.equal(out.status, 200);
    assert.equal(state.selectShapes.length, 1, 'login issues exactly one users select');
    const shape = state.selectShapes[0];
    assert.ok(shape, 'a reverted bare select() must fail this assertion');

    const selected = Object.keys(shape).sort();
    assert.deepEqual(selected, ['email1', 'fullName', 'id', 'password', 'role'].sort());

    const allowedColumns = Object.keys(getTableColumns(users))
        .filter(column => !EXCLUDED_FROM_NARROW_READS.includes(column));
    for (const column of selected) {
        assert.ok(allowedColumns.includes(column), `login must not select ${column}`);
    }
});

test('forgotPasswordSendOtp asks for exactly the columns its branches read, not the whole row', async () => {
    reset();
    // email1: null routes the controller to its 400 return before sendOtpEmail. sendOtpEmail is
    // mocked (see mock.module('./utils/email.ts', ...) above), so this particular choice of
    // fixture is no longer load-bearing for safety -- kept anyway so this test still asserts only
    // the column-shaping behavior, not the OTP-send path, which the row-1 test below covers.
    state.row = { id: 'u1', email1: null, password: '$2a$10$hash' };
    const { res, out } = makeRes();
    await forgotPasswordSendOtp(req({ phone: LOCAL }), res);

    assert.equal(out.status, 400, 'the email1: null branch must return before sendOtpEmail');
    assert.equal(state.selectShapes.length, 1, 'forgotPasswordSendOtp issues exactly one users select');
    const shape = state.selectShapes[0];
    assert.ok(shape, 'a reverted bare select() must fail this assertion');

    const selected = Object.keys(shape).sort();
    assert.deepEqual(selected, ['email1', 'id', 'password'].sort());

    const allowedColumns = Object.keys(getTableColumns(users))
        .filter(column => !EXCLUDED_FROM_NARROW_READS.includes(column));
    for (const column of selected) {
        assert.ok(allowedColumns.includes(column), `forgotPasswordSendOtp must not select ${column}`);
    }
});

// Matrix row 1 of spec-otp-reset-wrong-account.md: "Single match, has password + email |
// forgotPasswordSendOtp, phone matches exactly 1 row | 200, OTP row inserted, email sent --
// unchanged from today." Every other forgotPasswordSendOtp test in this file deliberately takes
// an early-return branch to dodge sendOtpEmail; this is the one test that drives the actual
// success path, made safe by the ./utils/email.ts mock above instead of a real Resend call.
test('matrix row 1: forgotPasswordSendOtp succeeds end-to-end on a single match with password and email', async () => {
    reset();
    state.row = { id: 'u1', email1: 'ploni@example.co', password: '$2a$10$hash' };
    const { res, out } = makeRes();
    await forgotPasswordSendOtp(req({ phone: LOCAL }), res);

    assert.equal(out.status, 200);
    assert.equal(typeof out.body?.maskedEmail, 'string', 'the response must carry a masked email string');
    assert.equal(state.inserts.length, 1, 'exactly one verificationCodes row must be inserted');
    assert.equal(state.emailsSent.length, 1, 'exactly one OTP email must be sent');
    assert.equal(state.emailsSent[0].to, 'ploni@example.co');
    assert.equal(
        state.emailsSent[0].code,
        (state.inserts[0] as { code: string }).code,
        'the code in the email must be the same code written to verificationCodes',
    );
});

// --- spec-otp-reset-wrong-account: ambiguous phone matches must be refused, not resolved -------
// matchesPhone's digits-only predicate can match more than one users row (e.g. two members whose
// mobiles normalize to the same digits). Both endpoints used to take .limit(1) and trust whatever
// row sorted first, which could email an OTP to -- or reset the password of -- the wrong account.
// The fix: fetch up to 2 rows and refuse whenever the count isn't exactly 1, using the identical
// response the endpoint already gives for zero matches, so a caller can't distinguish the two.

test('forgotPasswordSendOtp refuses a 2-row phone match exactly like a 0-row match, sends no OTP', async () => {
    reset();
    const { res: zeroRes, out: zeroOut } = makeRes();
    await forgotPasswordSendOtp(req({ phone: '+972-99-999-9999' }), zeroRes);
    assert.equal(zeroOut.status, 400);

    reset();
    state.rows = [
        { id: 'u1', email1: 'a@b.co', password: '$2a$10$hash' },
        { id: 'u2', email1: 'c@d.co', password: '$2a$10$hash' },
    ];
    const { res, out } = makeRes();
    await forgotPasswordSendOtp(req({ phone: LOCAL }), res);

    assert.equal(out.status, zeroOut.status, 'ambiguous match must return the same status as no match');
    assert.deepEqual(out.body, zeroOut.body, 'ambiguous match must return the same body as no match -- no distinct message');
    assert.equal(state.inserts.length, 0, 'an ambiguous match must not insert a verification code');
    assert.equal(state.emailsSent.length, 0, 'an ambiguous match must not send an OTP email');
});

test('regression: forgotPasswordSendOtp is unaffected when exactly one row matches', async () => {
    reset();
    // password: null routes the controller to its own 400 branch, distinct from the ambiguous-
    // match branch above, proving the single-row path still runs its own logic unchanged.
    state.row = { id: 'u1', email1: 'a@b.co', password: null };
    const { res, out } = makeRes();
    await forgotPasswordSendOtp(req({ phone: LOCAL }), res);

    assert.equal(out.status, 400);
    assert.deepEqual(out.body, { message: 'לחשבון זה אין סיסמה מוגדרת', noPassword: true });
});

test('resetPassword refuses a 2-row phone match exactly like its no-account-with-password case', async () => {
    reset();
    const { res: zeroRes, out: zeroOut } = makeRes();
    await resetPassword(req({ phone: '+972-99-999-9999', otp: '123456', newPassword: 'newpass' }), zeroRes);
    assert.equal(zeroOut.status, 400);

    reset();
    state.rows = [
        { id: 'u1', password: '$2a$10$hash' },
        { id: 'u2', password: '$2a$10$hash' },
    ];
    const { res, out } = makeRes();
    await resetPassword(req({ phone: LOCAL, otp: '123456', newPassword: 'newpass' }), res);

    assert.equal(out.status, zeroOut.status, 'ambiguous match must return the same status as no match');
    assert.deepEqual(out.body, zeroOut.body, 'ambiguous match must return the same body as no match -- no distinct message');
    assert.equal(state.selectShapes.length, 1, 'an ambiguous match must not read verificationCodes');
    assert.equal(state.updates.length, 0, 'an ambiguous match must not update a password');
});

// Matrix row 5 of spec-otp-reset-wrong-account.md: "Single match, no password on account |
// resetPassword, phone matches exactly 1 row, row.password null | existing 400 'לחשבון זה אין
// סיסמה...' -- unchanged." resetPassword shares one branch (and one message) for "no row" and
// "row with no password"; this proves the single-row/no-password shape is unaffected, distinct
// from the 0-row and ambiguous-match tests above.
test('matrix row 5: resetPassword refuses a single matching row that has no password', async () => {
    reset();
    state.row = { id: 'u1', password: null };
    const { res, out } = makeRes();
    await resetPassword(req({ phone: LOCAL, otp: '123456', newPassword: 'newpass' }), res);

    assert.equal(out.status, 400);
    assert.deepEqual(out.body, { message: 'לא נמצא חשבון עם סיסמה עבור מספר זה' });
    assert.equal(state.selectShapes.length, 1, 'no verificationCodes read when the row has no password');
    assert.equal(state.updates.length, 0);
});

test('regression: resetPassword succeeds end-to-end when exactly one row matches', async () => {
    reset();
    state.row = { id: 'u1', password: '$2a$10$hash' };
    state.otpRows = [{ id: 'vc1', userId: 'u1', code: '123456' }];
    const { res, out } = makeRes();
    await resetPassword(req({ phone: LOCAL, otp: '123456', newPassword: 'newpass' }), res);

    assert.equal(out.status, 200);
    assert.equal(out.body?.message, 'הסיסמה אופסה בהצלחה');
    const written = state.updates.find(u => (u as Record<string, unknown>).password !== undefined);
    assert.ok(written, 'the new password must be written to the single matching row');
});

test('getMe reports pwVerified and treats a token minted before the flag as unverified', () => {
    const verified = makeRes();
    getMe(req({}, { id: 'u1', name: 'ploni', role: 'owner', pwVerified: true }), verified.res);
    assert.deepEqual(verified.out.body, { id: 'u1', name: 'ploni', role: 'owner', pwVerified: true });

    const legacy = makeRes();
    getMe(req({}, { id: 'u1', name: 'ploni', role: 'owner' }), legacy.res);
    assert.equal(legacy.out.body?.pwVerified, false);
});

// --- Matrix rows 6 and 7: writes ---------------------------------------------------------------

test('row 7: a guest write attempt is 403 with no DB write', async () => {
    reset();
    state.passwordRow = { password: '$2a$10$hash' };
    const { res, out } = makeRes();
    await updateUser(
        req({ city: 'x' }, { id: '', name: '', role: 'guest', pwVerified: false }, { id: 'u1' }),
        res,
    );

    assert.equal(out.status, 403);
    assert.equal(state.updates.length, 0);
});

test('row 6: an unverified write on the caller own password-holding account is 403, no DB write', async () => {
    reset();
    state.passwordRow = { password: '$2a$10$hash' };
    const { res, out } = makeRes();
    await updateUser(
        req({ city: 'x' }, { id: 'u1', name: 'p', role: 'user', pwVerified: false }, { id: 'u1' }),
        res,
    );

    assert.equal(out.status, 403);
    assert.equal(state.updates.length, 0, 'the record must be unchanged');
});

test('row 6: a token that predates pwVerified is refused too, not just an explicit false', async () => {
    reset();
    state.passwordRow = { password: '$2a$10$hash' };
    const { res, out } = makeRes();
    // No pwVerified key at all -- the shape every session issued before this feature shipped.
    await updateUser(
        req({ city: 'x' }, { id: 'u1', name: 'p', role: 'user' }, { id: 'u1' }),
        res,
    );

    assert.equal(out.status, 403, 'the gate must fail closed on an absent flag');
    assert.equal(state.updates.length, 0);
});

test('regression: a verified write on the same account still succeeds', async () => {
    reset();
    state.passwordRow = { password: '$2a$10$hash' };
    const { res, out } = makeRes();
    await updateUser(
        req({ city: 'x' }, { id: 'u1', name: 'p', role: 'user', pwVerified: true }, { id: 'u1' }),
        res,
    );

    assert.equal(out.status, 200);
    assert.equal(state.updates.length, 1);
});

test('regression: a passwordless account still needs an OTP and a new password', async () => {
    reset();
    state.passwordRow = { password: null };
    const { res, out } = makeRes();
    await updateUser(
        req({ city: 'x' }, { id: 'u1', name: 'p', role: 'user', pwVerified: false }, { id: 'u1' }),
        res,
    );

    assert.equal(out.status, 400, 'still asks for an OTP and a new password, not 403');
    assert.equal(out.body?.message, 'נדרש קוד אימות וסיסמה חדשה');
    assert.equal(state.updates.length, 0);
});

test('setting a first password through the OTP flow re-issues the cookie as pwVerified', async () => {
    // Without this the member walks out of the OTP flow holding a pwVerified:false token for an
    // account that now HAS a password: their very next save would 403 with nothing telling them
    // to log in again. This is the one point where the two gates do overlap.
    reset();
    state.passwordRow = { password: null };
    state.otpRows = [{ id: 'vc1', userId: 'u1', code: '123456' }];
    const { res, out } = makeRes();
    await updateUser(
        req(
            { city: 'x', otp: '123456', newPassword: 'secret' },
            { id: 'u1', email: 'a@b.co', name: 'ploni', role: 'user', pwVerified: false },
            { id: 'u1' },
        ),
        res,
    );

    assert.equal(out.status, 200);
    assert.equal(out.body?.message, 'עודכן בהצלחה');

    const written = state.updates.find(u => (u as Record<string, unknown>).password !== undefined);
    assert.ok(written, 'the new password must be written');
    assert.match(String((written as Record<string, unknown>).password), /^\$2/, 'stored as a bcrypt hash');
    assert.ok(!('otp' in (written as Record<string, unknown>)), 'otp is not a member column');

    assert.ok(out.cookies.anash_token, 'a fresh cookie must be issued');
    const token = decodeCookie(out);
    assert.equal(token.pwVerified, true);
    assert.equal(token.id, 'u1');
    assert.equal(token.role, 'user', 'the re-issued token keeps the role, it does not grant one');
});

test('an admin setting a password on someone else does not re-issue their own cookie', async () => {
    reset();
    state.passwordRow = { password: '$2a$10$hash' };
    const { res, out } = makeRes();
    await updateUser(
        req({ newPassword: 'secret' }, { id: 'admin1', name: 'a', role: 'admin', pwVerified: true }, { id: 'u9' }),
        res,
    );

    assert.equal(out.status, 200);
    assert.equal(out.cookies.anash_token, undefined, 'the cookie belongs to the caller, not the target');
});

// --- Matrix row 8: guest read ------------------------------------------------------------------
// The assertions lead with the column set the controller ASKS drizzle for, which is what does the
// work. The mock projects the fixture through that set, so the response body corroborates it.

test('row 8: a guest read asks for the member columns and never the admin branch', async () => {
    reset();
    state.row = { id: 'u1', fullName: 'ploni', husbandMobile: LOCAL, city: 'צפת' };
    const { res, out } = makeRes();
    await getUserById(
        req({}, { id: '', name: '', role: 'guest', pwVerified: false }, { id: 'u1' }),
        res,
    );

    assert.equal(out.status, 200);
    assert.equal(state.selectShapes.length, 1, 'a guest must not trigger the own-record password lookup');

    const shape = state.selectShapes[0];
    assert.ok(shape, 'a guest must not reach the admin full-row select');
    const selected = Object.keys(shape);
    for (const column of PII_COLUMNS) {
        assert.ok(!selected.includes(column), `guest read must never select ${column}`);
    }
    for (const column of ['fullName', 'husbandMobile', 'wifeMobile', 'city', 'synagogue', 'email1']) {
        assert.ok(selected.includes(column), `guest read should still select ${column}`);
    }
    assert.ok(!(out.body && 'hasPassword' in out.body), 'hasPassword belongs to the own-record read only');
});

// --- Matrix row 8 contrast: the elevated read ---------------------------------------------------
// The branch used to hand drizzle a bare select(), so the whole row -- bcrypt hash included --
// reached the browser of anyone holding an elevated role. Both elevated roles are covered: the
// matrix row names admin OR owner, and the controller gates on `role === 'admin' || === 'owner'`.

/** A row carrying the hash, so a leak has something real to surface. */
const elevatedFixture = (id: string, role: string) => ({
    id, fullName: 'ploni', idNumber: '000000000', wifeIdNumber: '111111111',
    systemPhone1: '03', systemPhone2: '04', role, password: '$2a$10$hash',
});

function assertElevatedRead(out: { status: number; body: Record<string, unknown> | undefined }) {
    assert.equal(out.status, 200);
    assert.equal(state.selectShapes.length, 1, 'an elevated read is one query, with no hash lookup bolted on');

    // Every shape in the flow, not just the first -- otherwise a second `{ password }` lookup
    // added to this branch later would sail through the whole suite.
    for (const [i, shape] of state.selectShapes.entries()) {
        assert.ok(shape, `query ${i} must shape its columns, not take a bare select()`);
        assert.ok(!Object.keys(shape).includes('password'), `query ${i} must never select the bcrypt hash`);
    }

    const selected = Object.keys(state.selectShapes[0] as Record<string, unknown>);
    // card.tsx's admin block renders the four PII fields; `role` feeds the role selector elsewhere.
    for (const column of ['idNumber', 'wifeIdNumber', 'systemPhone1', 'systemPhone2', 'role']) {
        assert.ok(selected.includes(column), `an elevated read must still select ${column}`);
    }
    // Expressed independently of the controller's own constant, so this cross-checks it rather
    // than restating it. Both sides track the live schema, so a new column keeps this green.
    assert.deepEqual(
        [...selected].sort(),
        Object.keys(getTableColumns(users)).filter(c => c !== 'password').sort(),
        'the elevated set must be every users column except password',
    );

    // Real evidence, not a vacuous pass: the mock projects, and the fixture carries a hash.
    assert.ok(out.body && !('password' in out.body), 'no password key may reach the client');
}

for (const role of ['admin', 'owner'] as const) {
    test(`row 8 contrast: a ${role} read takes every users column except the bcrypt hash`, async () => {
        reset();
        state.row = elevatedFixture('u1', 'user');
        const { res, out } = makeRes();
        await getUserById(
            req({}, { id: `${role}1`, name: 'a', role, pwVerified: true }, { id: 'u1' }),
            res,
        );

        assertElevatedRead(out);
        assert.ok(!(out.body && 'hasPassword' in out.body), 'hasPassword belongs to the own-record read only');
    });

    test(`matrix: a ${role} reading their OWN record gets the same shape and still no hasPassword`, async () => {
        reset();
        state.row = elevatedFixture(`${role}1`, role);
        const { res, out } = makeRes();
        await getUserById(
            req({}, { id: `${role}1`, name: 'a', role, pwVerified: true }, { id: `${role}1` }),
            res,
        );

        assertElevatedRead(out);
        // $id.details.tsx gates editing on `user?.hasPassword === false`, so absence must stay
        // absence here -- an elevated caller reading themselves must not start reporting it.
        assert.ok(
            !(out.body && 'hasPassword' in out.body),
            'the elevated branch must not derive hasPassword, even on the caller own record',
        );
    });
}

test('an own-record read reports hasPassword, which the client edit gate depends on', async () => {
    reset();
    state.row = { id: 'u1', fullName: 'ploni' };
    state.passwordRow = { password: '$2a$10$hash' };
    const withPassword = makeRes();
    await getUserById(
        req({}, { id: 'u1', name: 'ploni', role: 'user', pwVerified: true }, { id: 'u1' }),
        withPassword.res,
    );
    assert.equal(withPassword.out.body?.hasPassword, true);

    reset();
    state.row = { id: 'u1', fullName: 'ploni' };
    state.passwordRow = { password: null };
    const without = makeRes();
    await getUserById(
        req({}, { id: 'u1', name: 'ploni', role: 'user', pwVerified: false }, { id: 'u1' }),
        without.res,
    );
    assert.equal(without.out.body?.hasPassword, false);
});

// --- Guests reach the whole directory, so every list endpoint must shape its columns ------------

test('getUsers asks only for the minimal directory columns, never the hash or PII', async () => {
    reset();
    state.row = { id: 'u1', fullName: 'ploni' };
    const { res, out } = makeRes();
    await getUsers(req({}, { id: '', name: '', role: 'guest' }), res);

    assert.equal(out.status, 200);
    const shape = state.selectShapes[0];
    assert.ok(shape, 'getUsers must never select every column');
    for (const column of PII_COLUMNS) {
        assert.ok(!Object.keys(shape).includes(column), `getUsers must never select ${column}`);
    }
    assert.ok(Object.keys(shape).includes('fullName'));
});

test('the name search asks only for the minimal directory columns', async () => {
    reset();
    state.row = { id: 'u1', fullName: 'ploni' };
    const { res, out } = makeRes();
    await getUserByFullName(
        req({}, { id: '', name: '', role: 'guest' }, {}, { fullname: 'ploni' }),
        res,
    );

    assert.equal(out.status, 200);
    const shape = state.selectShapes[0];
    assert.ok(shape, 'the search must never select every column');
    for (const column of PII_COLUMNS) {
        assert.ok(!Object.keys(shape).includes(column), `the search must never select ${column}`);
    }
});

// --- Role allowlists ----------------------------------------------------------------------------

test('changeOwnPassword admits only admin and owner, never guest or user', async () => {
    for (const role of ['guest', 'user', undefined]) {
        reset();
        const { res, out } = makeRes();
        await changeOwnPassword(
            req({ oldPassword: 'a', password: 'b' }, { id: 'u1', name: 'p', role }),
            res,
        );
        assert.equal(out.status, 403, `role ${String(role)} must be refused`);
        assert.equal(state.updates.length, 0);
    }
});

test('changeOwnPassword still works for an admin with the right current password', async () => {
    reset();
    state.passwordRow = { password: await bcrypt.hash('old', 4) };
    const { res, out } = makeRes();
    await changeOwnPassword(
        req({ oldPassword: 'old', password: 'new' }, { id: 'u1', name: 'p', role: 'admin' }),
        res,
    );

    assert.equal(out.status, 200);
    assert.equal(state.updates.length, 1);
    assert.match(String((state.updates[0] as Record<string, unknown>).password), /^\$2/);
});

test('sendEditOtp refuses a token that names no account', async () => {
    reset();
    const { res, out } = makeRes();
    await sendEditOtp(req({}, { id: '', name: '', role: 'guest', pwVerified: false }), res);

    assert.equal(out.status, 403, 'a guest must be refused outright, not told it has no email');
    assert.equal(state.selectShapes.length, 0, 'and must not reach the db');
});

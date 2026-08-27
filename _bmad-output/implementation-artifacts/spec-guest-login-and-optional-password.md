---
title: 'Guest login, password-optional entry, and header profile button'
type: 'feature'
created: '2026-08-27'
status: 'done'
baseline_commit: 'a78deb752e032ef95f5166d520d6374e82afabad'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Login matches the submitted phone only against `husband_mobile`/`wife_mobile` after a column-side cleanup that strips just `-` and spaces, so a number stored in any other shape (parentheses, dots, or a `972`/`+972` prefix) never matches and returns `Invalid credentials` — the error the user actually hits when entering `+972…`. Beyond that, anyone whose number is absent from the directory is locked out entirely, and a member whose account carries a password but who does not type it is rejected instead of being let in read-only.

**Approach:** Compare phones as digits only, against every plausible stored form, on both sides. Then admit every attempt: an unknown number becomes a `guest` identity; a known number without the account password becomes that member's identity capped at `user` role and flagged `pwVerified: false`. Gate profile writes on `pwVerified` so a token obtained without a password can never write. Reflect identity in the header — a guest greeting instead of a name, and a profile button for everyone else.

## Boundaries & Constraints

**Always:**
- Phone comparison is digits-only on both sides, accepting the local (`0546329221`), `972…`, and `00972…` stored forms. `normalizePhone` in `anash-server/utils/phone.ts` stays the single entry point for phone input.
- A token whose password was never verified must not grant write access to an account that has a password. `updateUser` fails closed.
- Role tests are allowlists (`role === 'admin' || role === 'owner'`), never negations like `role !== 'user'`.
- Never log member personal data. Guest attempts are not written to `user_logins` at all.

**Ask First:**
- Widening which columns authenticate a login beyond `husband_mobile` / `wife_mobile`.
- Any `db/schema.ts` change or migration.
- Connecting to the live Railway Postgres (`npm run dev` reaches real member data).

**Never:**
- Do not touch `getUserByPhoneNumber` — the search bug is recorded in `deferred-work.md` and is out of scope.
- No roles beyond adding `'guest'`; no change to how `admin`/`owner` are granted.
- Do not weaken the existing OTP gate that protects passwordless accounts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Intl. form, any stored shape | `POST /api/auth/login` with `+972-54-632-9221`; row stores `054 6329221` / `(054)632.9221` / `972546329221` | 200, matched, role from account | N/A |
| Unknown number | phone matches no row | 200, cookie set, `{user:{id:'',name:'',role:'guest'}}` | Nothing written to `user_logins` |
| Password held back | account has a password, body omits `password` | 200, role `user`, token carries `pwVerified:false` | Logged as a successful login |
| Wrong password | account has a password, wrong value supplied | 401 with the existing message | Logged as a failed login |
| Privileged account, no password | `owner`/`admin` phone, no password | 200 with role `user` — never the elevated role | N/A |
| Unverified write attempt | `PUT /api/users/:id` on own account that has a password, `pwVerified:false` | 403 | No DB write |
| Guest write attempt | `PUT /api/users/:id` with `id:''` | 403 | No DB write |
| Guest read | `GET /api/users/:id` | 200 with member columns only — no `idNumber`/`systemPhone*` block | N/A |
| Guest header | any protected page | guest greeting, profile button absent | N/A |

</frozen-after-approval>

## Code Map

- `anash-server/utils/phone.ts` -- `normalizePhone` (L11) already folds `+972`/`00972`/separators to local form correctly; the bug is NOT here. Add the candidate-forms helper here; the deferred search fix will reuse it.
- `anash-server/controllers/auth-controller.ts` -- `withoutSeparators` (L24) strips only `-` and space from the column = root cause. `matchesPhone` (L26) checks only `husbandMobile`/`wifeMobile` (read-only: do not widen). `login` (L130) holds all three branches to change; `getMe` (L126) must also emit `pwVerified`.
- `anash-server/controllers/user-controller.ts` -- `updateUser` L321 comment `// Password is set → JWT is sufficient, no further check needed` is the invariant this feature breaks; that branch is where `pwVerified` must be enforced. The passwordless OTP branch (L289-320) stays untouched.
- `anash-server/interfaces/jwt-params.ts` -- role union, needs `'guest'` plus an optional `pwVerified`.
- `anash-client/src/components/card.tsx` -- L14 `const isAdmin = role !== 'user'` fails OPEN for `'guest'` and reveals the PII block at L136 (`idNumber`, `wifeIdNumber`, `systemPhone1/2`). Must become an allowlist. Other branches at L175/L241-257 use `role === 'owner'` and are already safe.
- `anash-client/src/context/auth.tsx` -- L57 `role: (user?.role || 'user')` collapses an unknown role to `user`; the union is declared twice (L6, L12).
- `anash-client/src/root.tsx` -- `AppHeader` L45-86; greeting at L78, and the `headerEnd` block L75-84 is where the button goes.
- `anash-client/src/root.module.css` -- reuse the existing `btnGhost` (L93) for the new button; `headerEnd` already sets a 10px gap. Read-only, no new CSS needed.
- `anash-client/src/routes/users+/$id.details.tsx` -- L22 `canEdit = myId === id || role === 'owner'`; `anash-client/src/routes/users+/$id.edit.tsx` -- L77 access guard. Both need the `pwVerified` condition so an unverified user is not offered an edit the server will reject.
- `anash-client/src/models/user.ts` -- L32 role union.
- Read-only evidence: `anash-server/app.ts` L37 authenticates all of `/api/users/*` at the mount, so a guest token grants directory read access by design. `anash-client/src/routes/home.tsx` L157 and `login-logs.tsx` L48 already use allowlist role checks and need no change.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/utils/phone.ts` -- export `phoneMatchCandidates(phone: string): string[]` returning the local, `972…` and `00972…` digit forms of a normalized number -- one source of truth for phone matching, reused later by the deferred search fix.
- [x] `anash-server/utils/phone.test.ts` -- cover `normalizePhone` and `phoneMatchCandidates` across the matrix's input shapes using `node:test` + `node:assert` -- this is the pure logic the whole login fix rests on, and the repo has no test framework to lean on.
- [x] `anash-server/auth-flow.test.ts` -- controller-level cover for matrix rows 1-8: renders `matchesPhone` to SQL with drizzle's `PgDialect`, and drives `login` / `getMe` / `getUserById` / `updateUser` against a `mock.module`-substituted `db.ts` -- the matrix rows are behavioral, and the repo has no DI and no test framework to reach them any other way.
- [x] `anash-server/interfaces/jwt-params.ts` -- add `'guest'` to the role union and an optional `pwVerified: boolean` -- typed contract for both new token shapes.
- [x] `anash-server/controllers/auth-controller.ts` -- replace the column cleanup with a digits-only SQL normalization matched against `phoneMatchCandidates`; add the guest and password-held-back branches to `login`; include `pwVerified` in `getMe` -- the core of the feature.
- [x] `anash-server/controllers/user-controller.ts` -- in `updateUser`, require `pwVerified === true` before allowing the JWT-only write path on an account that has a password -- closes the impersonation hole the login change would otherwise open.
- [x] `anash-client/src/components/card.tsx` -- change `isAdmin` to an explicit `admin`/`owner` allowlist -- prevents a guest from being read as an admin and shown member PII.
- [x] `anash-client/src/context/auth.tsx` + `anash-client/src/models/user.ts` -- add `'guest'` to both role unions, expose `pwVerified`, and stop collapsing an unknown role to `user` -- guest state must survive into the UI.
- [x] `anash-client/src/root.tsx` -- render the guest greeting for guests, and a `btnGhost` profile link to `/users/{id}` shown only when the session names a real member -- the two visible outcomes of this feature.
- [x] `anash-client/src/routes/users+/$id.details.tsx` + `anash-client/src/routes/users+/$id.edit.tsx` -- include `pwVerified` in the edit gate -- an unverified user must not be offered an edit the server will reject.
- [x] Review round -- `anash-server/utils/auth-cookie.ts` (shared cookie definition) so `updateUser` can re-issue the token when a member sets their first password; `isPlausiblePhone` rejects non-numeric input before it reaches the phone columns; `phoneMatchCandidates` widened to the national and country-code-plus-trunk-zero forms; the three `matchesPhone` queries ordered and limited; `sendEditOtp` refuses a token that names no account; the client checks `res.ok`, tightens the edit gate to `hasPassword === false`, keys the profile link off the id alone, and keeps the guest greeting visible on phones.

**Acceptance Criteria:**
- Given a member whose stored number uses any separator or country-code variant, when they log in with either `+972…` or the local form, then both reach the same account.
- Given a guest session, when the directory is browsed, then records are readable but no edit affordance, no PII block, and no profile button appear anywhere.
- Given an `owner` who logs in without their password, when they open any owner-only surface (`/login-logs`, the role editor in `card.tsx`), then it is unavailable — the session behaves exactly like a plain `user`.
- Given a session that never proved a password, when a profile write is attempted for the account it names, then the server rejects it and the record is unchanged.
- Given an existing member with a correct password, when they log in as before, then role, permissions, and edit rights are unchanged from today.

## Design Notes

`pwVerified` means "the caller proved this account's password" — true only after a successful `bcrypt.compare`. It is deliberately false for passwordless accounts too; those are already protected by the OTP branch in `updateUser`, so for a given account only one of the two gates is ever live.

They do overlap at one moment: the OTP flow lets a member set their first password, which moves their account from the OTP gate to the `pwVerified` gate mid-session while the token in their browser still says `pwVerified: false`. Left alone, their next save would 403 and their edit link would vanish with nothing explaining why. `updateUser` therefore re-issues the auth cookie with `pwVerified: true` whenever the caller sets a password on their own record.

Phone matching compares candidate forms rather than converting the column, keeping the SQL simple while covering every stored variant:

```ts
const digitsOnly = (c: AnyPgColumn) => sql`regexp_replace(${c}, '[^0-9]', '', 'g')`;
// '0546329221' -> ['0546329221', '546329221', '972546329221',
//                  '00972546329221', '9720546329221', '009720546329221']
// Both the national and local forms, bare and behind each country-code prefix: rows exist
// stored without the trunk zero, and as '972-054-...' which keeps the code AND the zero.
const matchesPhone = (phone: string) => {
    const forms = phoneMatchCandidates(phone);
    return or(
        inArray(digitsOnly(users.husbandMobile), forms),
        inArray(digitsOnly(users.wifeMobile), forms),
    );
};
```

A held-back password is recorded in `user_logins` as `success: true` — the person did get in. Guest attempts are recorded nowhere, because `user_logins.userId` is `NOT NULL` with an FK to `users`, and a schema change is out of scope.

## Verification

**Commands:**
- `cd anash-server && npm test` -- `node --experimental-test-module-mocks --import tsx --test "**/*.test.ts"`, which discovers every `*.test.ts` so a new file is never silently skipped -- expected: 35 tests, 35 pass, 0 fail. The `--experimental-test-module-mocks` flag is required and pins the suite to Node >=22.3 (`engines` in `package.json`): `auth-flow.test.ts` substitutes `db.ts` with `mock.module` so no controller test reaches the live Railway Postgres. Matrix coverage: row 1 = the two `matchesPhone` SQL tests, rows 2-8 = the correspondingly named controller tests, row 9 = the manual check below.
- `cd anash-server && npx tsc --noEmit` -- expected: exactly one pre-existing line, `tsconfig.json(5,25): error TS5107` (the `moduleResolution=node10` deprecation), and nothing else. Any error naming a file under the package is new. Note `allowImportingTsExtensions`; relative imports keep their `.ts` suffix.
- `cd anash-server && npx eslint .` -- baseline comparison, not a clean run: the flat config declares no `globals`, so every `process` and `console` reference is a `no-undef`. Expected total **74 problems (52 errors, 22 warnings)** -- one below the 75 the feature started from, because `setAuthCookie` moved into `utils/auth-cookie.ts`. Any increase is new.
- `cd anash-client && npx tsc --noEmit` -- expected: no output. This is the only real type gate on the client; `vite build` does not typecheck.
- `cd anash-client && npm run lint` -- baseline comparison: the client ESLint config has no TypeScript parser, so every `.ts`/`.tsx` file is a parse error. Expected **171 problems**, unchanged. Any increase is new.
- `cd anash-client && npm run build` -- expected: a successful Vite build. It rewrites the tracked `build/` directory, which `AGENTS.md` calls a dead leftover; restore it with `git checkout -- anash-client/build && git clean -fdq anash-client/build` so the change set stays source-only.

**Manual checks (if no CLI):**
- Matrix row 9 (guest header) is not automatable -- the client has no test framework and adding one is out of scope. Check by hand: log in at `/login` with a phone number that is in no directory record and no password. The header must read `שלום אורח` with no member name, and must show only the `יציאה` button -- the `👤 הפרופיל שלי` link must be absent. Then open any record from the search results: no `✏️ ערוך פרטים` bar above the card, and no `🔐 מידע מנהל` section inside it. Log in again with a real member's number and correct password: the name, the profile link (to `/users/{id}`), and the edit bar on that member's own record must all be back.
- No live-database verification is performed. The `Invalid credentials` root cause is inferred from the code path; confirming which column and format hold the reporter's number requires the production Postgres and is gated by **Ask First**.

## Suggested Review Order

**The identity contract**

- Start here: the three outcomes login can now produce, and the token each mints.
  [`auth-controller.ts:162`](../../anash-server/controllers/auth-controller.ts#L162)

- An unknown number becomes a guest instead of a 401 — the widest behavioral change in the diff.
  [`auth-controller.ts:178`](../../anash-server/controllers/auth-controller.ts#L178)

- A held-back password admits the member but caps the role and clears pwVerified.
  [`auth-controller.ts:196`](../../anash-server/controllers/auth-controller.ts#L196)

- The typed contract both new token shapes are written against.
  [`jwt-params.ts:5`](../../anash-server/interfaces/jwt-params.ts#L5)

**Phone matching — the reported bug**

- Root cause: the column is now reduced to digits rather than stripped of two characters.
  [`auth-controller.ts:18`](../../anash-server/controllers/auth-controller.ts#L18)

- Six candidate forms cover every way a number may have been stored or typed.
  [`phone.ts:32`](../../anash-server/utils/phone.ts#L32)

- Input validation added so junk cannot reach the query as empty candidates.
  [`phone.ts:54`](../../anash-server/utils/phone.ts#L54)

**The write gate**

- The invariant this feature broke, now enforced explicitly instead of assumed.
  [`user-controller.ts:334`](../../anash-server/controllers/user-controller.ts#L334)

- Setting a password re-issues the cookie, or the member locks themselves out mid-session.
  [`user-controller.ts:374`](../../anash-server/controllers/user-controller.ts#L374)

- A guest names no account, so it is refused before any ownership comparison.
  [`user-controller.ts:290`](../../anash-server/controllers/user-controller.ts#L290)

**Client identity binding**

- Unknown roles fall back to guest, not user — least privilege on the client too.
  [`auth.tsx:8`](../../anash-client/src/context/auth.tsx#L8)

- Allowlist replaces a negation that would have shown a guest every member's PII.
  [`card.tsx:17`](../../anash-client/src/components/card.tsx#L17)

- The two visible outcomes: guest greeting, or name plus profile link.
  [`root.tsx:84`](../../anash-client/src/root.tsx#L84)

- The edit gate cannot pass by omission of hasPassword.
  [`$id.details.tsx:34`](../../anash-client/src/routes/users+/$id.details.tsx#L34)

- Tells the member the one action that restores editing, instead of silently hiding it.
  [`$id.details.tsx:58`](../../anash-client/src/routes/users+/$id.details.tsx#L58)

- The form is never offered when the server would reject the save.
  [`$id.edit.tsx:88`](../../anash-client/src/routes/users+/$id.edit.tsx#L88)

**Peripherals**

- Guest greeting survives at mobile widths; the profile pill drops to its icon.
  [`root.module.css:67`](../../anash-client/src/root.module.css#L67)

- Cookie options shared once two controllers began minting tokens.
  [`auth-cookie.ts:11`](../../anash-server/utils/auth-cookie.ts#L11)

- Controller-level suite covering matrix rows 1-8, including four mutation-caught gaps.
  [`auth-flow.test.ts:1`](../../anash-server/auth-flow.test.ts#L1)

- Pure phone logic, the layer the whole fix rests on.
  [`phone.test.ts:1`](../../anash-server/utils/phone.test.ts#L1)

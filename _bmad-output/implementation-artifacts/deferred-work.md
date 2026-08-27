- source_spec: none
  summary: Fix the phone-number search returning near-miss numbers — getUserByPhoneNumber strips the first 1-3 digits of every input before a LIKE '%...%' match.
  evidence: Split from the guest-login intent. It is an independent shippable deliverable — a different endpoint (GET /api/users/search/phone) in a different controller, with no shared code or coupling to the login/auth changes.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: user_logins cannot distinguish a login that proved the account password from a phone-only entry — both are recorded as success:true.
  evidence: The owner-facing /login-logs audit trail loses a real distinction the moment password-optional entry ships. Recording it needs a new column on user_logins, and schema changes are an Ask First item in the spec.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: Login authenticates only husband_mobile and wife_mobile, so a member whose number is stored in whatsapp_number, home_phone or system_phone_1/2 is now silently downgraded to a guest instead of being rejected.
  evidence: Raised during planning and deliberately left as Ask First. The guest change makes the failure quieter than the old Invalid credentials, so the member has no signal that their own record exists.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: The client and server disagree on admin write rights — the server lets admin or owner PUT any record, but both client guards check owner only, so an admin can never reach a form the API would accept.
  evidence: Pre-existing inconsistency in $id.details.tsx canEdit and $id.edit.tsx isOwner, surfaced while both guards were being rewritten for pwVerified.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: getUserById's admin branch selects the whole row, so it returns the bcrypt password hash to any admin or owner client.
  evidence: Pre-existing bare db.select().from(users). The guest read path was hardened in this story while this one was left as-is; the test file's own PII_COLUMNS list names password.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: Login mints a 3-day JWT into an 8-hour cookie, so the token stays valid for 2.6 days after the browser drops it and is accepted if replayed, with no revocation path.
  evidence: Pre-existing mismatch between expiresIn 3d and the cookie maxAge. Guests now receive such credentials too, which widens who holds one.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: auth-controller swallows every error into a generic Database error with no logging, and asserts JWT_SECRET non-null, so a missing secret surfaces as a silent 500.
  evidence: Pre-existing. user-controller console.errors throughout and middleware/auth.ts has an explicit JWT_SECRET misconfiguration check, so auth-controller is the outlier.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: Phone matching runs regexp_replace over two columns per row, so every login, forgot-password and reset sequentially scans the users table.
  evidence: Not a regression — the previous replace(replace(...)) cleanup was equally unsargable — but the fix locks the pattern in. An expression index or a normalized stored column would need a schema change.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: Nothing runs the test suite automatically — the repo has no CI, and Railway and the Dockerfile deploy with npm start only.
  evidence: Pre-existing absence of any .github/workflows. The suite added by this story therefore runs only when someone types npm test by hand.

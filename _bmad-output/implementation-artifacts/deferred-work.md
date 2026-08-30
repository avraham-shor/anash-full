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

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: The widened phone matching governs password reset as well as login, so where two records share a number forgotPasswordSendOtp and resetPassword can target the wrong account.
  evidence: matchesPhone is reused verbatim by forgotPasswordSendOtp and resetPassword, and both take the first row of orderBy(asc(users.id)).limit(1). users.id is text, so that ordering is lexicographic and effectively arbitrary — the OTP is mailed to whichever row sorts first and the new password lands on that same row. Distinct from the sequential-scan entry above, which covers the cost of the match rather than which row it picks. Raised in the checkpoint review of b14a09c.

- source_spec: `_bmad-output/implementation-artifacts/spec-guest-login-and-optional-password.md`
  summary: anash-server/Dockerfile pins node:20-bookworm-slim while package.json now declares engines node >=22.3, so the test suite cannot run inside the image that is actually deployed.
  evidence: npm test requires --experimental-test-module-mocks, which needs Node >=22.3. No .npmrc sets engine-strict, so npm install only warns and npm start still runs on Node 20 — the mismatch is silent today and surfaces only when someone tries to run the suite in the image. Distinct from the no-CI entry above, which covers the absence of a runner rather than the runtime being too old to be one. Raised in the checkpoint review of b14a09c.

- source_spec: `_bmad-output/implementation-artifacts/spec-admin-read-leaks-password-hash.md`
  summary: Two bare db.select() calls pull every users column, hash included, on the hottest auth paths - auth-controller login (L154) and forgotPasswordSendOtp (L246).
  evidence: Scoped out of the admin-read fix by explicit human decision. Neither row reaches a client, so this is over-fetching rather than a leak, but both hand the bcrypt hash and every PII column to process memory on every login and every password-reset request. The other two bare selects in the same controllers (auth-controller resetPassword, and updateUser) query verificationCodes, not users, and are not part of this.

- source_spec: `_bmad-output/implementation-artifacts/spec-admin-read-leaks-password-hash.md`
  summary: getUserById never checks whether a row was found - an unknown :id gives an admin 200 with an empty body, and gives a member reading their own id a 500.
  evidence: Both branches destructure the first element of an empty array. The admin branch res.json(undefined) answers 200 with no body, so the client treats a missing record as loaded. The own-record branch does const [{ password }] = ... which throws on the empty result and lands in the 500 handler. Pre-existing on both counts; surfaced by the adversarial review of this story, which touched the admin statement without changing this behavior.

- source_spec: `_bmad-output/implementation-artifacts/spec-admin-read-leaks-password-hash.md`
  summary: GET /api/users/:id sets no Cache-Control: no-store, so member records stay cacheable by any intermediary and by the browser back/forward cache.
  evidence: helmet in app.ts adds no cache header. Named in this specs own problem statement as part of the exposure, but out of scope for a fix that only shaped the columns. Every member record the directory serves is affected, not just the admin read.

- source_spec: `_bmad-output/implementation-artifacts/spec-admin-read-leaks-password-hash.md`
  summary: anash-server/eslint.config.js declares no Node globals and enables no-unused-vars alongside the TypeScript rule, so linting a controller reports nine no-undef errors for console at baseline and the repos _-prefix convention does not apply to variables.
  evidence: The flat config sets only argsIgnorePattern, neither varsIgnorePattern nor ignoreRestSiblings, which is why a rest-sibling binding could not be silenced by naming convention in this story (the derivation was ultimately restructured to avoid the binding, so no disable directive remains). The baseline noise also means a genuine new lint error in these files would be invisible. Note that branch chore/agents-context-refresh already carries e814dc1 fix(lint) repair both eslint configs - check whether that commit resolves this before opening new work.

- source_spec: `_bmad-output/implementation-artifacts/spec-admin-read-leaks-password-hash.md`
  summary: npx tsc --noEmit fails with TS5107 on moduleResolution node10 before it type-checks anything, so there is no working type gate on the server.
  evidence: Pre-existing tsconfig.json setting. Verifying a change requires diffing error counts against a stashed baseline rather than expecting a clean run, which is fragile and easy to skip.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-select-leaks-hash.md`
  summary: auth-controller's resetPassword has zero test coverage in auth-flow.test.ts — it is never imported or called from that file, unlike login and forgotPasswordSendOtp which this story added coverage for.
  evidence: Confirmed by grep — no reference to resetPassword anywhere in auth-flow.test.ts. resetPassword already uses the same shaped-select style this story applied to login/forgotPasswordSendOtp, but a regression there (e.g. reverting to a bare select(), or dropping the OTP/expiry checks) would go undetected. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-auth-select-leaks-hash.md`
  summary: resetPassword's second query, db.select().from(verificationCodes).where(...) at L304-313, is still a bare unshaped select, unlike the users lookup a few lines above it in the same function.
  evidence: Pre-existing, different table (verificationCodes, not users) so out of this story's scope by its own Never clause — but inconsistent with the "shape to what the branch reads" pattern the story establishes, and untested either way. Raised by the blind-hunter review layer during the checkpoint review of this story.

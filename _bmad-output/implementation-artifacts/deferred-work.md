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
- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-truncates-digits.md`
  summary: getUserByPhoneNumber has no controller-level test exercising it against a mocked db, unlike getUserById/getUsers/getUserByFullName which auth-flow.test.ts already covers.
  evidence: Pre-existing gap, not introduced by this story -- getUsersByPlace and updateUserPassword share it too. This story's own Tasks list scoped verification to the unit level (phoneSearchNeedle, phoneSearchCondition) deliberately, but a controller-level test would be the only thing that actually proves the wiring between them -- including the empty-needle guard -- is correct end to end. Raised independently by two review layers during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-truncates-digits.md`
  summary: phoneSearchNeedle strips only one leading zero, so an input that normalizes to multiple leading zeros (e.g. "00", "97200") reduces to the single-character needle "0" -- non-empty, so it passes the caller's !needle guard, and LIKE '%0%' then matches nearly every row in the directory.
  evidence: Concrete trigger for the general gap this story's own spec already named and deferred ("Ask First: A minimum digit count for the term (today abc1 reduces to 1 and returns most of the directory)"). Not a regression -- the pre-fix code leaked the literal entire table on the same input ("00" reduced to an empty cleanNumber, i.e. LIKE '%%') -- but the fixed code still leaks nearly all of it. Raised by the edge-case review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-short-needle-leak.md`
  summary: phoneSearchCondition's backstop (and isSearchableNeedle) checks only needle length, not that it is digits-only, so a caller that bypasses phoneSearchNeedle and passes a raw 3+ character string straight to phoneSearchCondition could inject LIKE wildcards (%, _).
  evidence: Pre-existing gap inherited from before this story -- the original `if (!needle)` guard also never checked content, only truthiness. phoneSearchCondition currently has exactly one caller (the controller, which always passes phoneSearchNeedle's output), so it is not exploitable today, but the backstop's own doc comment invites future direct use. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-short-needle-leak.md`
  summary: None of the fetch calls in anash-client/src/routes/home.tsx for the name and place searches catch a rejected promise or a malformed JSON body, so a network failure leaves the loading spinner stuck true forever with no feedback.
  evidence: Pre-existing across the whole file -- this story added .catch() handling only to the phone-search fetches it already owned, per its own Never clause against refactoring the name/place sites. Raised by the blind-hunter and edge-case-hunter review layers during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-short-needle-leak.md`
  summary: No search request in home.tsx is cancelled or sequenced (no AbortController, no request-id guard), so a slow, stale response from an earlier search can resolve after a newer search has started and overwrite its results.
  evidence: Pre-existing race across all three search types (phone, name, place); not introduced by this story, though writing both items and the new phoneSearchError from the same response makes a stale phone-search response's effect more visible. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-short-needle-leak.md`
  summary: anash-client has no test runner, test script, or testing-library/vitest/jest dependency at all, so no test exists or could exist for handlePhoneSearchResponse or the new error-state rendering in home.tsx.
  evidence: Confirmed via package.json (no test script, no test-framework dependency) and a repo-wide search for *.test.*/*.spec.* outside node_modules, which returns only the three anash-server test files. Closing this requires introducing a client test framework, a larger decision than this story's scope. Raised by the verification-gap review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-short-needle-leak.md`
  summary: The new phoneSearchError message in home.tsx has no aria-live/role="alert", so screen-reader users get no notification that their phone search was rejected.
  evidence: Consistent with the rest of the app's error states (e.g. passwordError) which also lack live-region announcement -- a repo-wide accessibility gap, not specific to this story, surfaced incidentally because this story added a new error message of the same kind. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-phone-search-short-needle-leak.md`
  summary: anash-server/AGENTS.md's phone-contract line (L23) documents only normalizePhone/phoneMatchCandidates/isPlausiblePhone -- it still doesn't mention phoneSearchNeedle (added by the prior phone-search story) or isSearchableNeedle (added by this one), even though the latter is now a mandatory pre-query check for any phone search.
  evidence: Pre-existing gap -- phoneSearchNeedle was already undocumented there before this story. This story's own spec Code Map explicitly listed the AGENTS.md line as read-only reference, scoping the update out. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-otp-reset-wrong-account.md`
  summary: resetPassword still has no test coverage for its invalid/expired-OTP (401) branch or its input-validation 400s (missing phone/otp/newPassword, newPassword length bounds).
  evidence: This story added resetPassword's first-ever tests (ambiguous-match refusal and the single-match success path), but these other branches sit right next to the new `rows.length !== 1 || !rows[0].password` condition and would silently pass a typo'd `&&` in place of `||` there. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-otp-reset-wrong-account.md`
  summary: forgotPasswordSendOtp inserts the verificationCodes row before calling sendOtpEmail, so a Resend failure leaves an orphaned, unusable OTP row while the caller sees a generic "Database error" 500 that misattributes the failure.
  evidence: Pre-existing ordering, not introduced by this story -- but this story's own utils/email.ts mock is what first makes a send-failure path cheap to simulate and test. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-otp-reset-wrong-account.md`
  summary: login runs the identical matchesPhone(...).orderBy(asc(users.id)).limit(1) pattern this story just fixed in forgotPasswordSendOtp/resetPassword, and still silently resolves an ambiguous phone match to whichever row's id sorts first -- but login hands out a live session/JWT, arguably the more sensitive of the three call sites.
  evidence: Explicitly out of scope for this story (its spec's Never clause preserves login's existing, previously-accepted behavior -- see the "login resolves a multi-row match deterministically, not arbitrarily" test in auth-flow.test.ts), but the review noted no tracked follow-up links the more severe variant of the same bug class anywhere. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-otp-reset-wrong-account.md`
  summary: A member whose phone number is genuinely shared with another account sees the same "no account found" message from forgotPasswordSendOtp/resetPassword as someone who mistyped their number, with no path to recovery (e.g. contact an admin).
  evidence: Deliberate anti-enumeration tradeoff, documented and correct as implemented in this story's Design Notes -- but a legitimately affected member has no signal to seek help. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-otp-reset-wrong-account.md`
  summary: Neither forgotPasswordSendOtp nor resetPassword logs anything when a phone number ambiguously matches 2+ rows, so operators have no way to discover how many members are silently locked out of self-service password reset or which duplicate-phone data needs cleanup.
  evidence: The client-facing response is intentionally indistinguishable from "no match" by design, so without server-side logging the ambiguity is invisible even internally. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-login-wrong-password-degrade.md`
  summary: login unconditionally overwrites any existing auth cookie with a fresh token derived from the submitted phone/password, so a login-form submission that fails to prove the account password (guest, held-back, or now also wrong password) silently downgrades an already-authenticated owner/admin session on the same browser instead of leaving it untouched.
  evidence: Pre-existing property of every non-verified branch of login (guest and held-back-password already did this before this story); this story's wrong-password branch just reaches the same unconditional issueToken call from one more input combination. Raised by the edge-case-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-login-wrong-password-degrade.md`
  summary: Once the one-time login warning is dismissed (or the page is reloaded), nothing in the UI ever again indicates that a session is capped at role 'user' / pwVerified:false, so a member who continues in degraded mode has no ongoing signal that they are missing permissions they think they have.
  evidence: Pre-existing gap since the held-back-password path shipped (spec-guest-login-and-optional-password) -- this story's wrong-password branch reaches the same pwVerified:false state, it does not introduce the missing indicator. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-login-wrong-password-degrade.md`
  summary: The new .formWarning message in login.tsx has no aria-live/role="alert" and no focus management, so screen-reader users get no notification that a wrong password was entered.
  evidence: Consistent with the rest of the app's error states (.formError, phoneSearchError) which also lack live-region announcement -- a repo-wide accessibility gap, not specific to this story. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-login-wrong-password-degrade.md`
  summary: anash-client still has no test runner, test script, or testing-library/vitest/jest dependency at all, so none of login.tsx's new passwordIncorrect state, warning banner, or skipped-navigation logic can be automated-tested.
  evidence: Pre-existing repo-wide gap (also named in spec-phone-search-short-needle-leak's deferred items); newly relevant here because this story's only client-visible behavior change has zero test coverage as a result. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-login-wrong-password-degrade.md`
  summary: The wrong-password warning's copy points every case at "שכחתי סיסמה", but for a password submitted against a passwordless account that flow immediately dead-ends into forgot-password.tsx's own "אין סיסמה מוגדרת לחשבון זה" screen instead of resetting anything.
  evidence: Not a true dead end -- that screen does redirect the member back to a phone-only login -- but it is an unnecessary extra round-trip and the warning's wording over-promises for that sub-case. Raised by the blind-hunter review layer during the checkpoint review of this story.

- source_spec: none
  summary: logout only clears the browser cookie -- there is no server-side revocation path, so a captured anash_token stays valid in middleware/auth.ts until it expires on its own.
  evidence: Split from the session-lifetime intent at step-01's multi-goal check. Revocation is independently shippable but needs a schema decision (revocation table vs a tokenVersion column on users) plus a check on every authenticated request, whereas aligning the token TTL with the cookie TTL is a contained three-file change with no migration.

- source_spec: `_bmad-output/implementation-artifacts/spec-jwt-cookie-ttl-mismatch.md`
  summary: logout hand-duplicates the anash_token cookie attributes in its own clearCookie call instead of sharing them with setAuthCookie, and has no test at all.
  evidence: A browser deletes a cookie only when the clear attributes match the set attributes, so if sameSite or secure ever changes in utils/auth-cookie.ts, logout silently stops clearing the session and nothing fails. The test harness's clearCookie stub also discards its arguments, so the path is unobservable. Raised by two review layers; the diff did not touch logout, so it is pre-existing. The missing piece is a clearAuthCookie(res) in the same module.

- source_spec: `_bmad-output/implementation-artifacts/spec-jwt-cookie-ttl-mismatch.md`
  summary: Nothing durable enforces that issueAuthToken stays the only place that calls jwt.sign -- the single-source-of-truth holds today only by convention.
  evidence: The spec's verification was a one-off grep. An eslint no-restricted-imports rule banning jsonwebtoken outside utils/auth-cookie.ts and middleware/auth.ts, or a test asserting jwt.sign appears in exactly one source file, would make the invariant self-guarding. Raised by the blind-hunter layer.

- source_spec: `_bmad-output/implementation-artifacts/spec-jwt-cookie-ttl-mismatch.md`
  summary: setAuthCookie is still exported and still accepts any pre-signed token, so the token/cookie lifetime invariant is enforced by convention rather than structurally.
  evidence: After the refactor nothing outside utils/auth-cookie.ts calls it -- both controllers import only issueAuthToken. Making it module-private would close the bypass and make the helper's own docstring literally true. Kept exported because the approved spec required it; flagged by all three review layers, so it deserves a deliberate decision rather than silent inheritance.

- source_spec: `_bmad-output/implementation-artifacts/spec-jwt-cookie-ttl-mismatch.md`
  summary: anash-client/src/routes/users+/$id.edit.tsx reads any 401 from its submit handler as a failed OTP, so an expired-session 401 is misreported to a passwordless member as a bad code.
  evidence: The submit handler branches on res.status === 401 into setStep('otp') whenever the member has no password, with no way to tell an auth-expiry 401 from an OTP rejection. Pre-existing and unrelated to the TTL change (the cookie already expired at 8h before it), but the review surfaced it as the sharpest case of the client having no global 401/403 handling.

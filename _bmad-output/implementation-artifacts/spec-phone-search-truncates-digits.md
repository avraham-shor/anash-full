---
title: 'Phone search truncates the typed number and compares it against raw columns'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
baseline_commit: 'eb096a9992d2b67b5ef7747f8fe864503ef6cb90'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `getUserByPhoneNumber` builds its search term with `number.trim().replace(/^[+\s]?\d{1,3}/, '')`, meant to peel a country code but eating the first 1–3 digits of *every* input: `0546329221` becomes `6329221`, and `LIKE '%6329221%'` returns unrelated members whose numbers contain that run. The same statement matches a digits-only term against the **raw** columns, so the stored shapes `utils/phone.ts` documents (`054-632-9221`, `972-054-632-9221`) never match at all; and input that reduces to nothing (`+972`, `0`) yields `LIKE '%%'`, dumping the directory to any authenticated caller, guests included.

**Approach:** Derive the term the way the auth paths already do — reduce to digits, fold a real `972`/`00972` prefix and the trunk zero, never drop typed digits — and match it as a substring against a digits-only projection of each phone column (`regexp_replace`). Reject a term that reduces to no digits instead of querying with it.

## Boundaries & Constraints

**Always:** Phone search stays **substring** search — callers may type part of a number. The term is digits-only (so `%`/`_` can never reach `LIKE`) and travels as a bound parameter. The digits-only projection must render byte-identical SQL to the one `auth-controller` ships today, so `auth-flow.test.ts` keeps passing. The same 6 columns stay searched (`homePhone`, `husbandMobile`, `wifeMobile`, `whatsappNumber`, `systemPhone1`, `systemPhone2`); `shul`/`city` filters, `minColumns` and `orderBy` are untouched.

**Ask First:** A minimum digit count for the term (today `abc1` reduces to `1` and returns most of the directory). Any index, generated column, or other schema change to make the match sargable.

**Never:** Do not reuse `phoneMatchCandidates`/`isPlausiblePhone` — they encode exact whole-number matching and a 7-digit floor, which breaks partial search. Do not move or change `matchesPhone`; only the shared `digitsOnly` helper relocates. No client changes, no response-shape changes, no touching the name search or `getUsersByPlace`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full local number | `number=0546329221` | Term `546329221`; matches rows stored as `0546329221`, `054-632-9221`, `(054)632.9221`, `546329221`, `972546329221`, `00972546329221`, `972-054-632-9221` | N/A |
| International form | `number=+972-54-632-9221` | Identical term and rows to the local form | N/A |
| Partial suffix / prefix | `number=6329221` / `number=054-632` | Term `6329221` / `54632`; substring match still finds the row | N/A |
| No near-miss leak | `number=0546329221`, row `0501234567` | Row **not** returned — leading digits are no longer discarded | N/A |
| Term reduces to empty | `number=+972` or `number=0` | No query is run | 400 `{ message: 'Invalid phone number' }` |
| Existing guards | missing / non-string / `length > 20` / no digit | unchanged | 400 `{ message: 'Invalid phone number' }` |
| Query failure | db throws | unchanged | 500 `{ message: 'Internal server error' }`, `console.error(err)` |

</frozen-after-approval>

## Code Map

- `anash-server/controllers/user-controller.ts` — `getUserByPhoneNumber` L156-190. Bug is L163-164 (term) and L166-173 (`like` on raw columns); L158 is the validation block to extend. L174 down is unchanged.
- `anash-server/utils/phone.ts` — pure string helpers, no drizzle. `normalizePhone` (L11) already strips separators/RTL marks and folds `+972`/`00972`; `phoneMatchCandidates` (L32) shows the national/trunk-zero derivation to mirror. `isPlausiblePhone` (L54) is the auth-only 7–15 digit gate, deliberately not reused.
- `anash-server/controllers/auth-controller.ts` — `digitsOnly` L18 (`sql\`regexp_replace(${column}, '[^0-9]', '', 'g')\``) is the helper to relocate; `matchesPhone` L21 stays and must keep using it.
- `anash-server/db/schema.ts` — phone columns L33-38. Imports only `drizzle-orm/pg-core`, never `db.ts`, so a module importing it unit-tests without a database.
- `anash-server/auth-flow.test.ts` — L165-198 render a predicate via `new PgDialect().sqlToQuery(...)` and assert `sql`/`params`. Pattern for the new test, and its `regexp_replace` assertions are the regression net for the `digitsOnly` move.
- `anash-server/utils/phone.test.ts` — style reference for the pure-function tests.
- Verified read-only: drizzle types `like` as `(column: Column | SQL.Aliased | SQL, value)`, so an SQL expression on the left is supported — same shape as the shipping `inArray(digitsOnly(...), …)`.

## Tasks & Acceptance

**Execution:**
- [x] `anash-server/utils/phone.ts` — add exported `phoneSearchNeedle(phone: string): string`: digits of `normalizePhone(phone)`, trunk zero dropped, `''` when none remain. Doc-comment in the file's voice, saying why it is substring-oriented and distinct from `phoneMatchCandidates`.
- [x] `anash-server/utils/phone-sql.ts` — new. `digitsOnly(column)` moved verbatim from `auth-controller` (comment included), plus `phoneSearchCondition(needle)` building the `or(...)` of `like(digitsOnly(col), '%needle%')` over the 6 columns. Separate file so `phone.ts` stays drizzle-free.
- [x] `anash-server/controllers/auth-controller.ts` — delete the local `digitsOnly`, import it from `../utils/phone-sql.ts`. Nothing else changes; `matchesPhone`'s rendered SQL must be identical.
- [x] `anash-server/controllers/user-controller.ts` — replace L163-173 with `phoneSearchNeedle` + `phoneSearchCondition`, returning the existing 400 when the needle is empty. Drop `like`/`or` imports only if unused elsewhere in the file.
- [x] `anash-server/utils/phone.test.ts` — cover `phoneSearchNeedle` across every Matrix input, empty-term cases included.
- [x] `anash-server/utils/phone-sql.test.ts` — new. Render `phoneSearchCondition` to SQL: all 6 columns wrapped in `regexp_replace`, term bound as `$1`…`$6` and never interpolated, old raw-column `like` shape gone.

**Acceptance Criteria:**
- Given a member stored as `054-632-9221` and an unrelated member stored as `0501234567`, when a caller searches `0546329221`, then only the first is returned.
- Given the existing suite, when `npm test` runs, then all 38 prior tests still pass — notably the `auth-flow.test.ts` row-1 SQL assertions, which prove the `digitsOnly` move changed nothing.
- Given any caller, when the term reduces to no digits, then no SQL is issued and the response is 400.

## Spec Change Log

## Design Notes

Why the *national* form is the needle: reduced to digits, every stored shape contains `546329221` — `0546329221`, `546329221`, `972546329221`, `00972546329221`, `9720546329221`, `009720546329221` — whereas `0546329221` as a substring misses every `972`-prefixed row. Verified against the real modules before this spec was written.

```ts
// utils/phone.ts
export function phoneSearchNeedle(phone: string): string {
    const digits = normalizePhone(phone).replace(/\D/g, '');
    return digits.startsWith('0') ? digits.slice(1) : digits;
}
```

Known cost, not a regression: `regexp_replace` over 6 columns with `LIKE '%…%'` is unsargable and scans `users`. The previous statement was equally unsargable; `deferred-work.md` already tracks making phone matching sargable, and the Ask First gate keeps schema work out of this change.

## Verification

**Commands:**
- `cd anash-server && npm test` — expected: 0 failures, total above the 38-test baseline (cases added, none removed).
- `cd anash-server && npx eslint .` — expected: 0 errors (baseline 0 errors / 12 `no-console` warnings; warnings must not grow).

## Suggested Review Order

**The fix itself — needle derivation and the query it drives**

- Entry point: the old truncating cleanup and raw-column `LIKE` are gone, replaced by a needle + an empty-needle 400 guard.
  [`user-controller.ts:158`](../../anash-server/controllers/user-controller.ts#L158)

- The new needle: keeps every typed digit, only a real country code / trunk zero is folded away.
  [`phone.ts:61`](../../anash-server/utils/phone.ts#L61)

- The new SQL predicate: substring match against a digits-only projection of all 6 phone columns.
  [`phone-sql.ts:27`](../../anash-server/utils/phone-sql.ts#L27)

**Hardening added during review — fail loud instead of leaking**

- `phoneSearchCondition` now throws on an empty needle instead of silently building `LIKE '%%'`.
  [`phone-sql.ts:27`](../../anash-server/utils/phone-sql.ts#L27)

**Shared helper relocation — no behavior change**

- `digitsOnly` moved out of `auth-controller` into the new shared module; `matchesPhone` now imports it.
  [`auth-controller.ts:12`](../../anash-server/controllers/auth-controller.ts#L12)

- Original definition site, for diffing against the relocated version.
  [`phone-sql.ts:15`](../../anash-server/utils/phone-sql.ts#L15)

**Tests**

- `phoneSearchNeedle` against every I/O Matrix row, including the near-miss-leak regression case.
  [`phone.test.ts:122`](../../anash-server/utils/phone.test.ts#L122)

- `phoneSearchCondition` rendered to SQL: all 6 columns, bound params, and the empty-needle guard.
  [`phone-sql.test.ts:10`](../../anash-server/utils/phone-sql.test.ts#L10)

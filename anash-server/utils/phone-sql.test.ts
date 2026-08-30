import test from 'node:test';
import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
import { phoneSearchCondition } from './phone-sql.ts';

// Renders the predicate the controller actually ships, the same technique auth-flow.test.ts uses
// for matchesPhone -- the bug being fixed here was in the SQL (LIKE against raw columns after a
// truncating cleanup), so the regression net has to be at the SQL level too.

test('phoneSearchCondition wraps all 6 phone columns in the shared digits-only projection', () => {
    const predicate = phoneSearchCondition('546329221');
    const { sql, params } = new PgDialect().sqlToQuery(predicate);

    assert.match(sql, /regexp_replace\("users"\."home_phone", '\[\^0-9\]', '', 'g'\) like \$1/);
    assert.match(sql, /regexp_replace\("users"\."husband_mobile", '\[\^0-9\]', '', 'g'\) like \$2/);
    assert.match(sql, /regexp_replace\("users"\."wife_mobile", '\[\^0-9\]', '', 'g'\) like \$3/);
    assert.match(sql, /regexp_replace\("users"\."whatsapp_number", '\[\^0-9\]', '', 'g'\) like \$4/);
    assert.match(sql, /regexp_replace\("users"\."system_phone_1", '\[\^0-9\]', '', 'g'\) like \$5/);
    assert.match(sql, /regexp_replace\("users"\."system_phone_2", '\[\^0-9\]', '', 'g'\) like \$6/);

    assert.deepEqual(params, Array(6).fill('%546329221%'));
});

test('phoneSearchCondition binds the needle as a parameter -- it never reaches the statement text', () => {
    const { sql } = new PgDialect().sqlToQuery(phoneSearchCondition('546329221'));
    assert.doesNotMatch(sql, /546329221/, 'the needle must be a bound parameter, not interpolated');
    // The bug being fixed: `LIKE` against the raw (non-digits-only) column.
    assert.doesNotMatch(sql, /"users"\."home_phone" like/, 'must compare the digits-only projection, not the raw column');
});

test('phoneSearchCondition refuses an empty needle instead of building the whole-directory-leaking LIKE \'%%\'', () => {
    assert.throws(() => phoneSearchCondition(''), /non-empty needle/);
});

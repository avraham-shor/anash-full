import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizePhone, phoneMatchCandidates, isPlausiblePhone, phoneSearchNeedle,
    isSearchableNeedle, PHONE_SEARCH_MIN_DIGITS,
} from './phone.ts';

const LOCAL = '0546329221';
const NATIONAL = '546329221';
// Every digits-only shape a row may hold: national and local, each bare and behind both
// country-code prefixes. "972-054-632-9221" keeps the country code AND the trunk zero.
const ALL_FORMS = [
    '0546329221',
    '546329221',
    '972546329221',
    '00972546329221',
    '9720546329221',
    '009720546329221',
];

test('normalizePhone folds every country-code prefix to the local form', () => {
    assert.equal(normalizePhone('0546329221'), LOCAL);
    assert.equal(normalizePhone('+972546329221'), LOCAL);
    assert.equal(normalizePhone('972546329221'), LOCAL);
    assert.equal(normalizePhone('00972546329221'), LOCAL);
    assert.equal(normalizePhone('+972-54-632-9221'), LOCAL);
    assert.equal(normalizePhone('+972 (54) 632.9221'), LOCAL);
    assert.equal(normalizePhone('+9720546329221'), LOCAL);
});

test('normalizePhone strips separators and RTL marks from the local form', () => {
    assert.equal(normalizePhone('054-632-9221'), LOCAL);
    assert.equal(normalizePhone('054 632 9221'), LOCAL);
    assert.equal(normalizePhone('(054)632.9221'), LOCAL);
    assert.equal(normalizePhone('‎054-6329221‏'), LOCAL);
});

test('normalizePhone returns an empty string for non-string input', () => {
    assert.equal(normalizePhone(undefined), '');
    assert.equal(normalizePhone(null), '');
    assert.equal(normalizePhone(12345), '');
    assert.equal(normalizePhone({}), '');
});

test('phoneMatchCandidates returns national and local, bare and behind both country codes', () => {
    assert.deepEqual(phoneMatchCandidates(LOCAL), ALL_FORMS);
});

test('every input shape in the matrix yields the same candidate set', () => {
    const shapes = [
        '0546329221',
        '054-632-9221',
        '054 632 9221',
        '(054)632.9221',
        '+972546329221',
        '+972-54-632-9221',
        '972546329221',
        '00972546329221',
        '00972-54-632-9221',
    ];
    for (const shape of shapes) {
        assert.deepEqual(
            phoneMatchCandidates(shape),
            ALL_FORMS,
            `unexpected candidates for ${shape}`,
        );
    }
});

test('candidates cover every stored shape once digits are extracted', () => {
    const stored = [
        '054 6329221', '(054)632.9221', '972546329221', '+972-54-632-9221', '00972546329221',
        '546329221',            // stored without the trunk zero
        '972-054-632-9221',     // country code AND trunk zero
        '00972-054-632-9221',
    ];
    const candidates = phoneMatchCandidates('+972-54-632-9221');
    for (const value of stored) {
        assert.ok(
            candidates.includes(value.replace(/\D/g, '')),
            `stored form ${value} is not covered by the candidate list`,
        );
    }
});

test('a number typed without its trunk zero reaches the same rows as the local form', () => {
    // The whole point of covering both: '546329221' must still find a row stored as '0546329221'.
    assert.deepEqual(phoneMatchCandidates(NATIONAL), ALL_FORMS);
    assert.deepEqual(phoneMatchCandidates(NATIONAL), phoneMatchCandidates(LOCAL));
    assert.ok(phoneMatchCandidates(NATIONAL).includes(LOCAL));
});

test('phoneMatchCandidates never emits an empty or zero-only form', () => {
    for (const input of ['', '   ', 'abc', '0', '+972', '00972']) {
        const candidates = phoneMatchCandidates(input);
        assert.ok(!candidates.includes(''), `empty candidate for ${JSON.stringify(input)}`);
        assert.ok(!candidates.includes('0'), `zero-only candidate for ${JSON.stringify(input)}`);
    }
    assert.deepEqual(phoneMatchCandidates('0'), []);
});

test('isPlausiblePhone rejects everything normalizePhone leaves non-numeric', () => {
    // normalizePhone is a formatter: 'abc' survives intact and '+972abc' becomes '0abc'.
    assert.equal(normalizePhone('abc'), 'abc');
    assert.equal(normalizePhone('+972abc'), '0abc');
    for (const bad of ['abc', '0abc', '', '0', '123456', '1'.repeat(16), '054-632-922x']) {
        assert.equal(isPlausiblePhone(normalizePhone(bad)), false, `should reject ${bad}`);
    }
    for (const good of ['0546329221', '+972-54-632-9221', '00972546329221', '025802020']) {
        assert.equal(isPlausiblePhone(normalizePhone(good)), true, `should accept ${good}`);
    }
});

test('phoneMatchCandidates returns nothing for input without digits', () => {
    assert.deepEqual(phoneMatchCandidates(''), []);
    assert.deepEqual(phoneMatchCandidates('   '), []);
    assert.deepEqual(phoneMatchCandidates('abc'), []);
});

test('phoneMatchCandidates never repeats a form', () => {
    const candidates = phoneMatchCandidates('+972546329221');
    assert.equal(new Set(candidates).size, candidates.length);
});

// --- phoneSearchNeedle: I/O & Edge-Case Matrix of spec-phone-search-truncates-digits.md --------

test('phoneSearchNeedle reduces a full local number to its national digits', () => {
    assert.equal(phoneSearchNeedle('0546329221'), '546329221');
});

test('phoneSearchNeedle folds an international form to the same needle as the local form', () => {
    assert.equal(phoneSearchNeedle('+972-54-632-9221'), '546329221');
    assert.equal(phoneSearchNeedle('972546329221'), '546329221');
    assert.equal(phoneSearchNeedle('00972546329221'), '546329221');
});

test('phoneSearchNeedle keeps every digit of a partial suffix or prefix -- it must never truncate', () => {
    assert.equal(phoneSearchNeedle('6329221'), '6329221');
    assert.equal(phoneSearchNeedle('054-632'), '54632');
});

test('phoneSearchNeedle returns an empty string when the input carries no digits of its own', () => {
    assert.equal(phoneSearchNeedle('+972'), '');
    assert.equal(phoneSearchNeedle('0'), '');
    assert.equal(phoneSearchNeedle(''), '');
    assert.equal(phoneSearchNeedle('   '), '');
});

test('phoneSearchNeedle, reduced to digits, is a substring of every stored shape it should match', () => {
    const needle = phoneSearchNeedle('+972-54-632-9221');
    const stored = [
        '0546329221', '054-632-9221', '(054)632.9221', '546329221',
        '972546329221', '00972546329221', '972-054-632-9221', '00972-054-632-9221',
    ];
    for (const value of stored) {
        assert.ok(value.replace(/\D/g, '').includes(needle), `stored form ${value} is not matched by needle ${needle}`);
    }
});

test('phoneSearchNeedle no longer leaks near-miss rows -- the fixed needle keeps the leading digits', () => {
    const needle = phoneSearchNeedle('0546329221');
    assert.equal(needle, '546329221');
    // The old cleanup (`replace(/^[+\s]?\d{1,3}/, '')`) dropped the leading "054", producing the
    // needle "6329221" -- which is a substring of this unrelated number, so it used to leak.
    const unrelatedRow = '0216329221';
    assert.ok(unrelatedRow.includes('6329221'), 'fixture must reproduce the old truncated needle to be meaningful');
    assert.ok(!unrelatedRow.replace(/\D/g, '').includes(needle), 'an unrelated stored number must not match the fixed needle');
});

// --- isSearchableNeedle: I/O & Edge-Case Matrix of spec-phone-search-short-needle-leak.md -------
// Every needle row is driven through the real reducer, isSearchableNeedle(phoneSearchNeedle(input)),
// so the test fails the same way a regression in either function would.

test('PHONE_SEARCH_MIN_DIGITS is 3', () => {
    assert.equal(PHONE_SEARCH_MIN_DIGITS, 3);
});

test('a full number reduces to a searchable needle', () => {
    assert.equal(isSearchableNeedle(phoneSearchNeedle('0546329221')), true);
});

test('a partial term of several digits is searchable', () => {
    assert.equal(phoneSearchNeedle('054-632'), '54632');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('054-632')), true);
});

test('a needle of exactly PHONE_SEARCH_MIN_DIGITS digits sits at the limit and is searchable', () => {
    assert.equal(phoneSearchNeedle('0546'), '546');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('0546')), true);
});

test('one digit short of the limit is rejected', () => {
    assert.equal(phoneSearchNeedle('054'), '54');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('054')), false);
});

test('a double zero reduces to the single digit "0" and is rejected (reported leak)', () => {
    assert.equal(phoneSearchNeedle('00'), '0');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('00')), false);
});

test('a bare country code plus zeros reduces to "0" and is rejected (reported leak)', () => {
    assert.equal(phoneSearchNeedle('97200'), '0');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('97200')), false);
});

test('letters with a single trailing digit reduce to that one digit and are rejected', () => {
    assert.equal(phoneSearchNeedle('abc1'), '1');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('abc1')), false);
});

test('input with no digits at all reduces to the empty string and is rejected', () => {
    assert.equal(phoneSearchNeedle('+972'), '');
    assert.equal(isSearchableNeedle(phoneSearchNeedle('+972')), false);
});

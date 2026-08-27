import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, phoneMatchCandidates, isPlausiblePhone } from './phone.ts';

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

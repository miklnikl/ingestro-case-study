import { describe, expect, it } from 'vitest';
import { generateTemporaryEmails } from './temporaryEmails';
import { validateRows } from './validateRows';
import { ChangeLog } from './changeLog';
import type { Row } from './types';
function row(key: number, email = ''): Row {
  return {
    key,
    values: {
      customer_id: `C-${key}`,
      first_name: 'Anna',
      last_name: 'Smith',
      email,
      signup_date: '2024-02-29',
      country: 'DE',
      plan: 'pro',
      monthly_spend: '19',
    },
    errors: {},
    corrected: false,
  };
}
describe('temporary emails', () => {
  it('fills only empty emails with unique valid placeholders and logs the changes', () => {
    const rows = [row(0), row(1), row(2, 'broken')];
    const log = new ChangeLog();
    generateTemporaryEmails(rows, 2, (row, next) => log.recordBulkEdit(row, next));
    validateRows(rows);
    expect(rows.map((row) => row.values.email)).toEqual([
      'temporary-1@example.invalid',
      'temporary-2@example.invalid',
      'broken',
    ]);
    expect(rows[0].errors.email).toBeUndefined();
    expect(rows[1].errors.email).toBeUndefined();
    expect(rows[2].errors.email).toBeTruthy();
    expect(log.page(1).changes).toBe(2);
    expect(log.page(1).items[0].description).toBe(
      'Bulk fix: email "" → "temporary-1@example.invalid"',
    );
  });
  it('avoids existing addresses and case variants without overwriting them', () => {
    const rows = [
      row(0),
      row(1, 'TEMPORARY-1@EXAMPLE.INVALID'),
      row(2, 'temporary-1-2@example.invalid'),
    ];
    generateTemporaryEmails(rows, 1, () => {});
    expect(rows[0].values.email).toBe('temporary-1-3@example.invalid');
    expect(rows[1].values.email).toBe('TEMPORARY-1@EXAMPLE.INVALID');
  });
  it('rejects stale or empty groups before changing or logging values', () => {
    const rows = [row(0)];
    let logs = 0;
    expect(() => generateTemporaryEmails(rows, 2, () => logs++)).toThrow('count has changed');
    expect(() => generateTemporaryEmails([row(1, 'valid@example.com')], 0, () => logs++)).toThrow();
    expect(rows[0].values.email).toBe('');
    expect(logs).toBe(0);
  });
  it('generates distinct emails for a 200,000-row dataset', () => {
    const rows = Array.from({ length: 200000 }, (_, key) => row(key));
    let count = 0;
    generateTemporaryEmails(rows, 200000, () => count++);
    expect(count).toBe(200000);
    expect(new Set(rows.map((row) => row.values.email)).size).toBe(200000);
    expect(rows.at(-1)?.values.email).toBe('temporary-200000@example.invalid');
  }, 15000);
});

it('generates for every malformed or empty email while preserving valid duplicate addresses', () => {
  const rows = [
    row(0, ''),
    row(1, 'broken'),
    row(2, 'broken'),
    row(3, 'duplicate@example.com'),
    row(4, 'duplicate@example.com'),
  ];
  const log = new ChangeLog();
  validateRows(rows);
  generateTemporaryEmails(rows, 3, (row, next) => log.recordBulkEdit(row, next), 'invalid');
  validateRows(rows);
  expect(rows.slice(0, 3).map((row) => row.values.email)).toEqual([
    'temporary-1@example.invalid',
    'temporary-2@example.invalid',
    'temporary-3@example.invalid',
  ]);
  expect(rows[3].values.email).toBe('duplicate@example.com');
  expect(rows[4].values.email).toBe('duplicate@example.com');
  expect(rows.slice(0, 3).every((row) => !row.errors.email)).toBe(true);
  expect(rows[3].errors.email).toContain('Duplicate');
  expect(log.page(1).changes).toBe(3);
});
it('all-invalid generation rejects stale counts before changing any address', () => {
  const rows = [row(0, ''), row(1, 'broken')],
    before = structuredClone(rows);
  let logged = 0;
  expect(() => generateTemporaryEmails(rows, 1, () => logged++, 'invalid')).toThrow(
    'count has changed',
  );
  expect(rows).toEqual(before);
  expect(logged).toBe(0);
});

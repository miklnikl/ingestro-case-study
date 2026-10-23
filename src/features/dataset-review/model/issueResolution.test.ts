import { describe, expect, it } from 'vitest';
import {
  collectIssueGroups,
  removeIssueRows,
  replaceIssueValues,
  replacementValue,
} from './issueResolution';
import { validateRows } from './validateRows';
import { ChangeLog } from './changeLog';
import type { Row } from './types';
function fixture(): Row[] {
  const base = {
    first_name: 'Anna',
    last_name: 'Smith',
    email: 'anna@example.com',
    country: 'DE',
    plan: 'pro',
    monthly_spend: '10',
    signup_date: '2024-02-29',
  };
  const rows: Row[] = [
    {
      key: 0,
      values: { ...base, customer_id: 'C-1', signup_date: '2024-02-30', monthly_spend: '' },
      errors: {},
      corrected: false,
    },
    {
      key: 1,
      values: {
        ...base,
        customer_id: 'C-2',
        email: 'leon@example.com',
        signup_date: '',
        country: '',
        last_name: '',
        monthly_spend: '-3',
      },
      errors: {},
      corrected: false,
    },
    {
      key: 2,
      values: { ...base, customer_id: 'C-3', email: 'mia@example.com' },
      errors: {},
      corrected: false,
    },
  ];
  validateRows(rows);
  return rows;
}
describe('issue resolution', () => {
  it('separates empty and invalid values and returns bounded preview samples', () => {
    const groups = collectIssueGroups(fixture());
    expect(groups.find((group) => group.field === 'signup_date')).toMatchObject({
      count: 2,
      empty: 1,
      invalid: 1,
      samples: {
        empty: [{ customerId: 'C-2', value: '' }],
        invalid: [{ customerId: 'C-1', value: '2024-02-30' }],
      },
    });
  });
  it('normalizes and validates replacement inputs without allowing uniqueness-sensitive fields', () => {
    expect(replacementValue('country', 'Germany')).toEqual({ success: true, value: 'DE' });
    expect(replacementValue('plan', ' PRO ')).toEqual({ success: true, value: 'pro' });
    expect(replacementValue('monthly_spend', '0')).toEqual({ success: true, value: '0' });
    for (const [field, value] of [
      ['signup_date', '2024-02-30'],
      ['country', 'ZZ'],
      ['last_name', '  '],
      ['monthly_spend', '-1'],
      ['email', 'new@example.com'],
      ['customer_id', 'new-id'],
    ] as const) {
      expect(replacementValue(field, value).success).toBe(false);
    }
  });
  it('replaces only invalid nonempty values and logs each affected value', () => {
    const rows = fixture();
    const log = new ChangeLog();
    replaceIssueValues(rows, 'signup_date', 'invalid', '2024-03-01', 1, (row, next) =>
      log.recordBulkEdit(row, next),
    );
    validateRows(rows);
    expect(rows.map((row) => row.values.signup_date)).toEqual(['2024-03-01', '', '2024-02-29']);
    expect(rows[0].errors.signup_date).toBeUndefined();
    expect(rows[1].errors.signup_date).toBeTruthy();
    expect(log.page(1).items[0].description).toBe(
      'Bulk fix: signup date "2024-02-30" → "2024-03-01"',
    );
  });
  it('fills empty spend with zero while preserving negative and valid values', () => {
    const rows = fixture();
    replaceIssueValues(rows, 'monthly_spend', 'empty', '0', 1, () => {});
    expect(rows.map((row) => row.values.monthly_spend)).toEqual(['0', '-3', '10']);
  });
  it('rejects invalid values and stale counts before modifying or logging anything', () => {
    const rows = fixture();
    const before = structuredClone(rows);
    let logged = 0;
    expect(() =>
      replaceIssueValues(rows, 'monthly_spend', 'empty', '-1', 1, () => logged++),
    ).toThrow();
    expect(() =>
      replaceIssueValues(rows, 'signup_date', 'invalid', '2024-03-01', 2, () => logged++),
    ).toThrow('group has changed');
    expect(() => removeIssueRows(rows, 'signup_date', 99, () => logged++)).toThrow();
    expect(logged).toBe(0);
    expect(rows).toEqual(before);
  });
  it('removes entire records in a group and recalculates overlapping issues', () => {
    const rows = fixture();
    const removed: number[] = [];
    const next = removeIssueRows(rows, 'signup_date', 2, (row) => removed.push(row.key));
    validateRows(next);
    expect(removed).toEqual([0, 1]);
    expect(next).toHaveLength(1);
    expect(collectIssueGroups(next)).toEqual([]);
  });
  it('limits previews to three rows even for large groups', () => {
    const rows = Array.from({ length: 1000 }, (_, key) => ({ ...fixture()[0], key }));
    const date = collectIssueGroups(rows).find((group) => group.field === 'signup_date');
    expect(date?.count).toBe(1000);
    expect(date?.samples.invalid).toHaveLength(3);
  });
});

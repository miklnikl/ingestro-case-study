import { describe, expect, it } from 'vitest';
import { listIssueValues, replaceIssueValue } from './issueValues';
import { validateRows } from './validateRows';
import type { Row } from './types';
function row(key: number, plan = 'frees'): Row {
  return {
    key,
    values: {
      customer_id: `C-${key}`,
      first_name: 'Anna',
      last_name: 'Smith',
      email: `anna${key}@example.com`,
      signup_date: '2024-02-29',
      country: 'DE',
      plan,
      monthly_spend: '19',
    },
    errors: {},
    corrected: false,
  };
}
function fixture() {
  const rows = [row(0), row(1), row(2, 'pros'), row(3, 'free'), row(4, '')];
  validateRows(rows);
  return rows;
}
describe('exact invalid-value replacement', () => {
  it('lists only invalid values with exact counts, search and bounded samples', () => {
    const rows = fixture();
    const options = listIssueValues(rows, 'plan', '', 50);
    expect(options.total).toBe(3);
    expect(options.options).toEqual([
      { value: 'frees', count: 2, customerIds: ['C-0', 'C-1'] },
      { value: 'pros', count: 1, customerIds: ['C-2'] },
      { value: '', count: 1, customerIds: ['C-4'] },
    ]);
    expect(listIssueValues(rows, 'plan', 'FRE', 50).options.map((option) => option.value)).toEqual([
      'frees',
    ]);
    expect(listIssueValues(rows, 'plan', 'empty', 50).options[0].value).toBe('');
  });
  it('replaces only the selected invalid value, preserving other values and fields', () => {
    const rows = fixture();
    let changes = 0;
    replaceIssueValue(rows, 'plan', 'frees', ' FREE ', 2, () => changes++);
    validateRows(rows);
    expect(rows.map((row) => row.values.plan)).toEqual(['free', 'free', 'pros', 'free', '']);
    expect(changes).toBe(2);
    expect(rows[0].values.email).toBe('anna0@example.com');
    expect(rows[0].errors.plan).toBeUndefined();
    expect(rows[2].errors.plan).toBeTruthy();
  });
  it('supports the empty-value group without replacing other invalid dates', () => {
    const rows = [row(0), row(1)];
    rows[0].values.signup_date = '';
    rows[1].values.signup_date = '2024-02-30';
    validateRows(rows);
    replaceIssueValue(rows, 'signup_date', '', '2024-03-01', 1, () => {});
    expect(rows.map((row) => row.values.signup_date)).toEqual(['2024-03-01', '2024-02-30']);
  });
  it('rejects invalid replacements and stale or absent groups before changes or logging', () => {
    const rows = fixture(),
      before = structuredClone(rows);
    let count = 0;
    expect(() => replaceIssueValue(rows, 'plan', 'frees', 'invalid', 2, () => count++)).toThrow();
    expect(() => replaceIssueValue(rows, 'plan', 'frees', 'free', 1, () => count++)).toThrow(
      'group has changed',
    );
    expect(() => replaceIssueValue(rows, 'plan', 'free', 'pro', 1, () => count++)).toThrow();
    expect(count).toBe(0);
    expect(rows).toEqual(before);
  });
  it('allows one invalid email or ID to become a unique valid value', () => {
    const rows = [row(0), row(1)];
    rows[0].values.email = 'broken';
    rows[0].values.customer_id = '';
    validateRows(rows);
    replaceIssueValue(rows, 'email', 'broken', 'new@example.com', 1, () => {});
    replaceIssueValue(rows, 'customer_id', '', 'C-new', 1, () => {});
    validateRows(rows);
    expect(rows[0].values.email).toBe('new@example.com');
    expect(rows[0].errors.email).toBeUndefined();
    expect(rows[0].values.customer_id).toBe('C-new');
  });
  it('blocks unique-field collisions and applying the same unique value to multiple rows', () => {
    const rows = [row(0), row(1)];
    rows[0].values.email = 'broken';
    rows[1].values.email = 'broken';
    validateRows(rows);
    expect(() =>
      replaceIssueValue(rows, 'email', 'broken', 'new@example.com', 2, () => {}),
    ).toThrow('would create duplicates');
    rows[1].values.email = 'used@example.com';
    validateRows(rows);
    expect(() =>
      replaceIssueValue(rows, 'email', 'broken', 'used@example.com', 1, () => {}),
    ).toThrow('already used');
    expect(rows[0].values.email).toBe('broken');
  });
  it('paginates distinct options and handles 200,000 rows with bounded responses', () => {
    const rows = Array.from({ length: 200000 }, (_, key) => ({
      ...row(key, `invalid-${key % 100}`),
      errors: { plan: 'Invalid plan' },
    }));
    const page = listIssueValues(rows, 'plan', '', 50);
    expect(page.total).toBe(100);
    expect(page.options).toHaveLength(50);
    expect(page.options[0].count).toBe(2000);
    expect(page.options[0].customerIds).toHaveLength(3);
    expect(listIssueValues(rows, 'plan', '', 100).options).toHaveLength(100);
    let count = 0;
    replaceIssueValue(rows, 'plan', 'invalid-0', 'free', 2000, () => count++);
    expect(count).toBe(2000);
    expect(rows[0].values.plan).toBe('free');
    expect(rows[1].values.plan).toBe('invalid-1');
  }, 15000);
});

it('email dropdown excludes valid duplicates and empty emails but includes malformed emails', () => {
  const rows = [row(0), row(1), row(2), row(3), row(4)];
  rows[0].values.email = 'duplicate@example.com';
  rows[1].values.email = 'duplicate@example.com';
  rows[2].values.email = 'broken';
  rows[3].values.email = 'broken';
  rows[4].values.email = '';
  validateRows(rows);
  expect(listIssueValues(rows, 'email', '', 50)).toMatchObject({
    total: 1,
    options: [{ value: 'broken', count: 2 }],
  });
  expect(listIssueValues(rows, 'email', 'duplicate', 50).options).toEqual([]);
  expect(listIssueValues(rows, 'email', 'empty', 50).options).toEqual([]);
});

it('sorts every field by descending frequency before pagination and preserves first occurrence for ties', () => {
  const fields = [
    'customer_id',
    'first_name',
    'last_name',
    'email',
    'signup_date',
    'country',
    'plan',
    'monthly_spend',
  ] as const;
  for (const field of fields) {
    const values = ['rare', 'popular', 'middle', 'popular', 'middle', 'popular', 'tie'];
    const rows = values.map((value, key) => {
      const record = row(key);
      record.values[field] = value;
      record.errors = { [field]: 'Invalid value' };
      return record;
    });
    expect(listIssueValues(rows, field, '', 1).options.map((option) => option.value)).toEqual([
      'popular',
    ]);
    expect(listIssueValues(rows, field, '', 10).options.map((option) => option.value)).toEqual([
      'popular',
      'middle',
      'rare',
      'tie',
    ]);
    expect(listIssueValues(rows, field, 'r', 10).options.map((option) => option.value)).toEqual([
      'popular',
      'rare',
    ]);
  }
});

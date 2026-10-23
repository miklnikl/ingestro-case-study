import { describe, expect, it } from 'vitest';
import { positiveSpend, correctNegativeSpend } from './negativeSpend';
import { validateRows } from './validateRows';
import { collectIssueGroups } from './issueResolution';
import { ChangeLog } from './changeLog';
import type { Row } from './types';
function row(key: number, value: string): Row {
  return {
    key,
    values: {
      customer_id: `C-${key}`,
      first_name: 'Anna',
      last_name: 'Smith',
      email: `anna${key}@example.com`,
      signup_date: '2024-01-01',
      country: 'DE',
      plan: 'pro',
      monthly_spend: value,
    },
    errors: {},
    corrected: false,
  };
}
function fixture() {
  const rows = ['-19', '-12.34567890123456789', '0', '25', '', 'TBD', '-1,50'].map((value, key) =>
    row(key, value),
  );
  validateRows(rows);
  return rows;
}
describe('negative spend correction', () => {
  it('removes the sign without rounding decimals and skips unsupported or non-negative values', () => {
    expect(positiveSpend('-19')).toBe('19');
    expect(positiveSpend('-0.123456789012345678901')).toBe('0.123456789012345678901');
    for (const value of [
      '',
      '0',
      '-0',
      '19',
      'TBD',
      '-1,50',
      '-Infinity',
      '-1e3',
      '-' + '9'.repeat(400),
    ]) {
      expect(positiveSpend(value)).toBeNull();
    }
  });
  it.each(['positive', 'zero'] as const)(
    'converts negatives to %s, logs edits and preserves other fields and values',
    (mode) => {
      const rows = fixture();
      const log = new ChangeLog();
      expect(
        collectIssueGroups(rows).find((group) => group.field === 'monthly_spend')?.negativeSpend
          ?.count,
      ).toBe(2);
      correctNegativeSpend(rows, mode, 2, (row, next) => log.recordBulkEdit(row, next));
      validateRows(rows);
      expect(rows.map((row) => row.values.monthly_spend)).toEqual(
        mode === 'positive'
          ? ['19', '12.34567890123456789', '0', '25', '', 'TBD', '-1,50']
          : ['0', '0', '0', '25', '', 'TBD', '-1,50'],
      );
      expect(log.page(1).changes).toBe(2);
      expect(rows[0].errors.monthly_spend).toBeUndefined();
      expect(rows[4].errors.monthly_spend).toBeTruthy();
      expect(rows[0].values.email).toBe('anna0@example.com');
    },
  );
  it('rejects stale and empty batches before modifying or logging anything', () => {
    const rows = fixture(),
      before = structuredClone(rows);
    let logged = 0;
    expect(() => correctNegativeSpend(rows, 'positive', 9, () => logged++)).toThrow(
      'count has changed',
    );
    expect(() => correctNegativeSpend([row(1, '0')], 'zero', 0, () => logged++)).toThrow();
    expect(logged).toBe(0);
    expect(rows).toEqual(before);
  });
  it('bounds preview samples', () => {
    const rows = Array.from({ length: 20 }, (_, key) => row(key, '-10'));
    validateRows(rows);
    const preview = collectIssueGroups(rows)[0].negativeSpend;
    expect(preview?.count).toBe(20);
    expect(preview?.samples).toHaveLength(3);
  });
  it('processes a 200,000-row batch', () => {
    const rows = Array.from({ length: 200000 }, (_, key) => ({
      ...row(key, '-19.50'),
      errors: { monthly_spend: 'Negative' },
    }));
    let logged = 0;
    correctNegativeSpend(rows, 'positive', 200000, () => logged++);
    expect(logged).toBe(200000);
    expect(rows[0].values.monthly_spend).toBe('19.50');
    expect(rows.at(-1)?.values.monthly_spend).toBe('19.50');
  }, 20000);
});

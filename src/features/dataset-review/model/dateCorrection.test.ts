import { describe, expect, it } from 'vitest';
import { correctInvalidDates, nearestValidDate } from './dateCorrection';
import { collectIssueGroups } from './issueResolution';
import { validateRows } from './validateRows';
import { ChangeLog } from './changeLog';
import type { Row } from './types';
function row(key: number, date: string): Row {
  return {
    key,
    values: {
      customer_id: `C-${key}`,
      first_name: 'Anna',
      last_name: 'Smith',
      email: `anna${key}@example.com`,
      signup_date: date,
      country: 'DE',
      plan: 'pro',
      monthly_spend: '19',
    },
    errors: {},
    corrected: false,
  };
}
describe('nearest valid date correction', () => {
  it('corrects impossible February days to the nearest boundary in either direction', () => {
    expect(nearestValidDate('2025-02-30', 'earlier')).toBe('2025-02-28');
    expect(nearestValidDate('2025-02-30', 'later')).toBe('2025-03-01');
    expect(nearestValidDate('2024-02-30', 'earlier')).toBe('2024-02-29');
    expect(nearestValidDate('2024-02-30', 'later')).toBe('2024-03-01');
  });
  it('respects century leap-year rules and 30-day months', () => {
    expect(nearestValidDate('1900-02-29', 'earlier')).toBe('1900-02-28');
    expect(nearestValidDate('2000-02-30', 'earlier')).toBe('2000-02-29');
    expect(nearestValidDate('2025-04-31', 'earlier')).toBe('2025-04-30');
    expect(nearestValidDate('2025-04-31', 'later')).toBe('2025-05-01');
  });
  it('handles year changes and day zero without rolling overflowing days too far', () => {
    expect(nearestValidDate('2025-12-32', 'later')).toBe('2026-01-01');
    expect(nearestValidDate('2025-01-00', 'earlier')).toBe('2024-12-31');
    expect(nearestValidDate('2025-01-00', 'later')).toBe('2025-01-01');
    expect(nearestValidDate('2025-02-99', 'later')).toBe('2025-03-01');
  });
  it('skips valid, empty, unrecognized and invalid-month values', () => {
    for (const value of [
      '',
      'garbage',
      '03/04/2025',
      '2025-13-01',
      '2025-00-01',
      '2024-02-29',
      '2025-01-01',
    ]) {
      expect(nearestValidDate(value, 'earlier')).toBeNull();
      expect(nearestValidDate(value, 'later')).toBeNull();
    }
    expect(nearestValidDate('0000-01-00', 'earlier')).toBeNull();
    expect(nearestValidDate('9999-12-32', 'later')).toBeNull();
  });
  it('previews only correctable records, applies the batch and logs each correction', () => {
    const rows = [
      row(0, '2025-02-30'),
      row(1, '2024-02-30'),
      row(2, ''),
      row(3, 'garbage'),
      row(4, '2025-01-01'),
    ];
    validateRows(rows);
    const preview = collectIssueGroups(rows).find(
      (group) => group.field === 'signup_date',
    )?.dateCorrections;
    expect(preview?.earlier.count).toBe(2);
    expect(preview?.later.count).toBe(2);
    expect(preview?.earlier.samples[0]).toMatchObject({
      before: '2025-02-30',
      after: '2025-02-28',
    });
    const log = new ChangeLog();
    correctInvalidDates(rows, 'earlier', 2, (row, next) => log.recordBulkEdit(row, next));
    validateRows(rows);
    expect(rows.map((row) => row.values.signup_date)).toEqual([
      '2025-02-28',
      '2024-02-29',
      '',
      'garbage',
      '2025-01-01',
    ]);
    expect(log.page(1).changes).toBe(2);
    expect(rows[0].errors.signup_date).toBeUndefined();
    expect(rows[2].errors.signup_date).toBeTruthy();
  });
  it('rejects stale or empty batches before changing or logging records', () => {
    const rows = [row(0, '2025-02-30')];
    validateRows(rows);
    let logged = 0;
    expect(() => correctInvalidDates(rows, 'later', 2, () => logged++)).toThrow(
      'count has changed',
    );
    expect(() => correctInvalidDates([row(1, '')], 'earlier', 0, () => logged++)).toThrow();
    expect(rows[0].values.signup_date).toBe('2025-02-30');
    expect(logged).toBe(0);
  });
  it('bounds preview samples for large groups', () => {
    const rows = Array.from({ length: 100 }, (_, key) => row(key, '2025-02-30'));
    validateRows(rows);
    const preview = collectIssueGroups(rows)[0].dateCorrections;
    expect(preview?.earlier.count).toBe(100);
    expect(preview?.earlier.samples).toHaveLength(3);
  });
});

import { describe, expect, it } from 'vitest';
import { deduplicateEmails, emailDuplicateSummary } from './emailDeduplication';
import { validateRows } from './validateRows';
import type { Row } from './types';
function row(key: number, date: string, email = 'anna@example.com'): Row {
  return {
    key,
    values: {
      customer_id: `C-${key}`,
      first_name: 'Anna',
      last_name: 'Smith',
      email,
      signup_date: date,
      country: 'DE',
      plan: 'pro',
      monthly_spend: String(key),
    },
    errors: {},
    corrected: false,
  };
}
describe('email deduplication', () => {
  it('keeps the earliest or latest date while preserving the entire chosen record', () => {
    const rows = [
      row(0, '2024-02-01'),
      row(1, '2023-01-01'),
      row(2, '2025-01-01'),
      row(3, '2024-01-01', 'unique@example.com'),
    ];
    expect(emailDuplicateSummary(rows)).toEqual({ groups: 1, removable: 2 });
    const removed: number[] = [];
    const earliest = deduplicateEmails(rows, 'earliest', 2, (record) => removed.push(record.key));
    expect(earliest).toEqual([rows[1], rows[3]]);
    expect(removed).toEqual([0, 2]);
    expect(deduplicateEmails(rows, 'latest', 2, () => {})).toEqual([rows[2], rows[3]]);
  });
  it('prefers a valid date over empty or impossible dates for either option', () => {
    const rows = [row(0, ''), row(1, '2025-02-30'), row(2, '2024-06-01')];
    for (const order of ['earliest', 'latest'] as const) {
      expect(deduplicateEmails(rows, order, 2, () => {})).toEqual([rows[2]]);
    }
  });
  it('keeps the first original CSV record for equal dates or only invalid dates', () => {
    for (const dates of [
      ['2024-06-01', '2024-06-01'],
      ['', '2025-02-30'],
    ]) {
      const first = row(2, dates[0]),
        later = row(7, dates[1]);
      for (const order of ['earliest', 'latest'] as const) {
        expect(deduplicateEmails([later, first], order, 1, () => {})).toEqual([first]);
      }
    }
  });
  it('excludes empty emails and treats email matching as case-sensitive', () => {
    const rows = [
      row(0, '2024-01-01', ''),
      row(1, '2024-01-01', ''),
      row(2, '2024-01-01', 'Anna@example.com'),
      row(3, '2024-01-01'),
      row(4, '2025-01-01'),
    ];
    expect(emailDuplicateSummary(rows)).toEqual({ groups: 1, removable: 1 });
    expect(deduplicateEmails(rows, 'latest', 1, () => {}).map((row) => row.key)).toEqual([
      0, 1, 2, 4,
    ]);
  });
  it('leaves malformed email values invalid after deduplication', () => {
    const rows = [row(0, '2024-01-01', 'broken'), row(1, '2025-01-01', 'broken')];
    const next = deduplicateEmails(rows, 'latest', 1, () => {});
    validateRows(next);
    expect(next).toHaveLength(1);
    expect(next[0].errors.email).toBeTruthy();
  });
  it('rejects stale or empty operations before logging or removing anything', () => {
    const rows = [row(0, '2024-01-01'), row(1, '2025-01-01')];
    let logged = 0;
    expect(() => deduplicateEmails(rows, 'earliest', 9, () => logged++)).toThrow('have changed');
    expect(() => deduplicateEmails([rows[0]], 'earliest', 0, () => logged++)).toThrow(
      'No duplicate',
    );
    expect(logged).toBe(0);
    expect(rows).toHaveLength(2);
  });
  it('handles 200,000 records without sorting or changing survivor order', () => {
    const rows = Array.from({ length: 200000 }, (_, key) =>
      row(key, key % 2 ? '2025-01-01' : '2024-01-01', `customer${Math.floor(key / 2)}@example.com`),
    );
    expect(emailDuplicateSummary(rows)).toEqual({ groups: 100000, removable: 100000 });
    const result = deduplicateEmails(rows, 'latest', 100000, () => {});
    expect(result).toHaveLength(100000);
    expect(result[0].key).toBe(1);
    expect(result.at(-1)?.key).toBe(199999);
  }, 15000);
});

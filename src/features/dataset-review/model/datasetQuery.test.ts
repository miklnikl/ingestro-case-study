import { describe, expect, it } from 'vitest';
import {
  datasetFilterOptions,
  datasetQuerySearch,
  queryDataset,
  readDatasetQuery,
  recordHref,
} from './datasetQuery';
import type { Row } from './types';
const base = readDatasetQuery('');
function row(key: number, country = 'DE', plan = 'free', date = '2024-01-01', spend = '10'): Row {
  return {
    key,
    corrected: false,
    errors: {},
    values: {
      customer_id: `C-${key}`,
      first_name: 'Anna',
      last_name: 'Smith',
      email: `${key}@example.com`,
      country,
      plan,
      signup_date: date,
      monthly_spend: spend,
    },
  };
}
describe('dataset URL queries', () => {
  it('round-trips filters, empty values and escaped IDs while preserving unrelated params', () => {
    const query = {
      ...base,
      search: 'Anna & Leon',
      onlyErrors: true,
      country: '',
      plan: 'pro',
      id: 'A+B /?',
      sort: 'monthly_spend' as const,
      order: 'desc' as const,
    };
    expect(readDatasetQuery(datasetQuerySearch(query, '?theme=dark'))).toEqual(query);
    expect(datasetQuerySearch(query, '?theme=dark')).toContain('theme=dark');
    expect(readDatasetQuery('?sort=unknown&order=bad')).toMatchObject({
      sort: undefined,
      order: 'asc',
    });
  });
  it('record links clear other filters so the record remains visible', () => {
    expect(
      recordHref(
        'C &1',
        '?country=DE&plan=pro&q=missing&issues=1&sort=signup_date&order=desc&theme=dark',
      ),
    ).toBe('?theme=dark&id=C+%261#/');
  });
  it('combines exact filters over all rows before pagination and supports original ID aliases', () => {
    const rows = Array.from({ length: 1000 }, (_, key) => row(key));
    rows[999].errors.country = 'Invalid';
    expect(
      queryDataset(rows, {
        ...base,
        id: 'C-999',
        country: 'DE',
        plan: 'free',
        onlyErrors: true,
        search: 'anna',
      }).map((r) => r.key),
    ).toEqual([999]);
    expect(
      queryDataset(rows, { ...base, id: 'old' }, (key, id) => key === 999 && id === 'old').map(
        (r) => r.key,
      ),
    ).toEqual([999]);
    expect(queryDataset(rows, { ...base, id: 'C-999', plan: 'pro' })).toEqual([]);
  });
  it('sorts numeric amounts and real dates, keeps invalid values last, and breaks ties by original order', () => {
    const rows = [
      row(0, 'DE', 'free', '2024-02-30', 'bad'),
      row(1, 'DE', 'free', '2024-01-02', '100'),
      row(2, 'DE', 'free', '2023-12-31', '9'),
      row(3, 'DE', 'free', '2024-01-02', '9'),
    ];
    expect(queryDataset(rows, { ...base, sort: 'monthly_spend' }).map((r) => r.key)).toEqual([
      2, 3, 1, 0,
    ]);
    expect(
      queryDataset(rows, { ...base, sort: 'monthly_spend', order: 'desc' }).map((r) => r.key),
    ).toEqual([1, 2, 3, 0]);
    expect(
      queryDataset(rows, { ...base, sort: 'signup_date', order: 'desc' }).map((r) => r.key),
    ).toEqual([1, 3, 2, 0]);
    expect(rows.map((r) => r.key)).toEqual([0, 1, 2, 3]);
  });
  it('orders filter options by frequency including empty values', () => {
    expect(
      datasetFilterOptions([row(0, 'FR', 'pro'), row(1, 'DE'), row(2, 'DE'), row(3, '', 'pro')]),
    ).toEqual({ countries: ['DE', 'FR', ''], plans: ['pro', 'free'] });
  });
});

it('sorts and filters 200,000 records without limiting the source or changing its order', () => {
  const rows = Array.from({ length: 200000 }, (_, key) =>
    row(key, key % 2 ? 'DE' : 'FR', 'pro', '2024-01-01', String(key)),
  );
  const found = queryDataset(rows, {
    ...base,
    country: 'DE',
    plan: 'pro',
    sort: 'monthly_spend',
    order: 'desc',
  });
  expect(found).toHaveLength(100000);
  expect(found[0].key).toBe(199999);
  expect(found.at(-1)?.key).toBe(1);
  expect(rows[0].key).toBe(0);
});

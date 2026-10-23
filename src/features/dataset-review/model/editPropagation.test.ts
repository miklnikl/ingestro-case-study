import { describe, expect, it } from 'vitest';
import { suggestEditPropagation } from './editPropagation';
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
      signup_date: '2024-01-01',
      country: 'DE',
      plan,
      monthly_spend: '19',
    },
    errors: {},
    corrected: false,
  };
}
function fixture() {
  const rows = [row(0, 'free'), row(1), row(2), row(3, 'pros'), row(4, 'free')];
  validateRows(rows);
  return rows;
}
describe('table edit propagation suggestions', () => {
  it('counts only remaining invalid cells with the exact old value', () => {
    expect(suggestEditPropagation(fixture(), 'plan', 'frees', 'free', true)).toEqual({
      field: 'plan',
      source: 'frees',
      value: 'free',
      count: 2,
      customerIds: ['C-1', 'C-2'],
    });
  });
  it('never proposes unique fields, valid-to-valid edits, no-ops or invalid replacements', () => {
    const rows = fixture();
    expect(suggestEditPropagation(rows, 'email', 'broken', 'new@example.com', true)).toBeNull();
    expect(suggestEditPropagation(rows, 'customer_id', '', 'new-id', true)).toBeNull();
    expect(suggestEditPropagation(rows, 'plan', 'frees', 'free', false)).toBeNull();
    expect(suggestEditPropagation(rows, 'plan', 'frees', 'frees', true)).toBeNull();
    expect(suggestEditPropagation(rows, 'plan', 'frees', 'another-typo', true)).toBeNull();
    expect(suggestEditPropagation(rows, 'plan', 'missing-source', 'free', true)).toBeNull();
  });
  it('supports empty old values and fixes in every non-unique column', () => {
    for (const [field, source, value] of [
      ['first_name', '', 'Anna'],
      ['last_name', '', 'Smith'],
      ['country', 'ZZ', 'DE'],
      ['signup_date', '2025-02-30', '2025-02-28'],
      ['monthly_spend', '-19', '19'],
      ['plan', 'frees', 'free'],
    ] as const) {
      const record = row(1, 'pro');
      record.values[field] = source;
      validateRows([record]);
      expect(suggestEditPropagation([record], field, source, value, true)).toMatchObject({
        field,
        source,
        value,
        count: 1,
      });
    }
  });
  it('bounds example IDs without limiting the full-dataset match count', () => {
    const rows = Array.from({ length: 200000 }, (_, key) => ({
      ...row(key),
      errors: { plan: 'Invalid plan' },
    }));
    const suggestion = suggestEditPropagation(rows, 'plan', 'frees', 'free', true);
    expect(suggestion?.count).toBe(200000);
    expect(suggestion?.customerIds).toEqual(['C-0', 'C-1', 'C-2']);
  }, 15000);
});

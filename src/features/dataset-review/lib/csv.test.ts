import { describe, expect, it } from 'vitest';
import { exportCsv, parseCsv } from './csv';
import { fields, type Values } from '../model/types';
import { normalize } from '../model/normalize';
import { schema } from '../model/schema';
import { validateRows } from '../model/validateRows';
const valid: Values = {
  customer_id: 'C-1',
  first_name: 'Anna',
  last_name: 'Smith, Jr.',
  email: 'anna@example.com',
  signup_date: '2024-02-29',
  country: 'DE',
  plan: 'pro',
  monthly_spend: '19.50',
};
const csv = (lines: string[]) => fields.join(',') + '\n' + lines.join('\n');
const line = 'C-1,Anna,Smith,anna@example.com,2024-02-29,DE,pro,19.50';
describe('data boundary', () => {
  it('normalizes only supported formats', () => {
    const row = normalize({
      ...valid,
      first_name: ' Anna ',
      country: 'Deutschland',
      plan: ' PRO ',
      signup_date: '03/04/2024',
      monthly_spend: '1,234.50',
    });
    expect(row).toMatchObject({
      first_name: 'Anna',
      country: 'DE',
      plan: 'pro',
      signup_date: '2024-04-03',
      monthly_spend: '1234.50',
    });
    expect(schema.safeParse(row).success).toBe(true);
    expect(normalize({ ...valid, monthly_spend: '€ 19,50' }).monthly_spend).toBe('19.50');
  });
  it('rejects impossible dates, missing names, typos, unknown countries and negative amounts', () => {
    for (const patch of [
      { signup_date: '2023-02-29' },
      { last_name: '' },
      { plan: 'enterprize' },
      { country: 'ZZ' },
      { monthly_spend: '-1' },
    ]) {
      expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
    expect(schema.safeParse(valid).success).toBe(true);
  });
  it('reads quoted commas and embedded newlines, and round trips', () => {
    const rows = parseCsv(
      csv(['C-1,"Anna\nMarie","Smith, Jr.",anna@example.com,2024-02-29,DE,pro,19.50']),
    );
    expect(rows[0].values.last_name).toBe('Smith, Jr.');
    expect(parseCsv(exportCsv(rows))[0].values).toEqual(rows[0].values);
  });
  it('marks both duplicate rows, blocks export, and clears duplicates after deletion', () => {
    const rows = parseCsv(csv([line, line.replace('C-1', 'C-2')]));
    expect(rows.every((r) => r.errors.email)).toBe(true);
    expect(() => exportCsv(rows)).toThrow();
    rows.pop();
    validateRows(rows);
    expect(rows[0].errors).toEqual({});
    expect(exportCsv(rows)).toContain('anna@example.com');
  });
  it('rejects broken structure without silently losing data', () => {
    expect(() => parseCsv('wrong,header\na,b')).toThrow(
      /Unsupported file format due to incorrect columns.*missing columns: customer_id.*unexpected columns: wrong, header/,
    );
    expect(() => parseCsv(csv([line + ',extra']))).toThrow(
      'Unsupported file format due to an incorrect number of cells at CSV record 2: found 9, expected 8. No rows were imported.',
    );
    expect(() => parseCsv(csv(['"unterminated']))).toThrow(
      /Unsupported file format due to malformed CSV structure.*Quoted field unterminated/,
    );
    expect(() =>
      parseCsv(fields.join(',').replace('first_name', 'customer_id') + '\n' + line),
    ).toThrow(/duplicate columns: customer_id/);
  });
  it('escapes spreadsheet formula cells on export', () => {
    const rows = parseCsv(csv([line.replace('Anna', '=1+1')]));
    expect(exportCsv(rows)).toContain("'=1+1");
  });
  it('keeps invalid rows available for correction', () => {
    const rows = parseCsv(csv([line.replace('2024-02-29', '2024-02-30')]));
    expect(rows).toHaveLength(1);
    expect(rows[0].errors.signup_date).toBeTruthy();
    expect(() => exportCsv(rows)).toThrow();
    rows[0].values.signup_date = '2024-02-29';
    validateRows(rows);
    expect(rows[0].errors).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';
import { ChangeLog } from './changeLog';
import { parseCsv } from '../lib/csv';
import { fields, type Row, type Values } from './types';
const values: Values = {
  customer_id: 'C-1',
  first_name: 'Anna',
  last_name: 'Smith',
  email: 'anna@example.com',
  signup_date: '2024-02-29',
  country: 'DE',
  plan: 'pro',
  monthly_spend: '19',
};
function row(key = 0, patch: Partial<Values> = {}): Row {
  return {
    key,
    values: { ...values, customer_id: `C-${key + 1}`, ...patch },
    errors: {},
    corrected: false,
  };
}
describe('change history', () => {
  it('captures exact import values and groups identical changes before individual entries', () => {
    const log = new ChangeLog();
    const text =
      fields.join(',') +
      '\nC-1, Anna ,Smith,anna@example.com,2024-02-29,Germany,PRO,19\nC-2,Leon,Smith,leon@example.com,2024-02-29,Germany,pro,19';
    parseCsv(text, (original, record) => log.recordImport(original, record));
    const page = log.page(1);
    expect(page.changes).toBe(4);
    expect(page.groups).toBe(1);
    expect(page.items[0]).toMatchObject({
      kind: 'group',
      ids: ['C-1', 'C-2'],
      description: 'Import formatting: country "Germany" → "DE"',
    });
    expect(page.items[1]).toMatchObject({
      kind: 'single',
      customerId: 'C-1',
      description: 'Import formatting: first name " Anna " → "Anna"',
    });
    expect(page.items[2].description).toContain('plan "PRO" → "pro"');
  });
  it('records edits, reversions and deletion under the original ID', () => {
    const log = new ChangeLog();
    const record = row();
    log.recordImport({ ...record.values }, record);
    log.recordEdit(record, { ...record.values });
    expect(log.page(1).changes).toBe(0);
    const next = { ...record.values, customer_id: 'renamed' };
    log.recordEdit(record, next);
    record.values = next;
    const updated = { ...next, country: 'FR' };
    log.recordEdit(record, updated);
    record.values = updated;
    const reverted = { ...updated, country: 'DE' };
    log.recordEdit(record, reverted);
    record.values = reverted;
    log.recordDelete(record);
    expect(log.page(1).changes).toBe(4);
    expect(
      log.page(1).items.every((item) => item.kind === 'single' && item.customerId === 'C-1'),
    ).toBe(true);
    expect(log.page(1).items.at(-1)?.description).toBe('Row removed');
  });
  it('does not group repeated changes to only one record', () => {
    const log = new ChangeLog();
    const record = row();
    log.recordEdit(record, { ...record.values, country: 'FR' });
    log.recordEdit(record, { ...record.values, country: 'FR' });
    expect(log.page(1).groups).toBe(0);
    expect(log.page(1).items).toHaveLength(2);
  });
  it('retains imported history when a row is removed and falls back for missing IDs', () => {
    const log = new ChangeLog();
    const record = row(7, { customer_id: '' });
    log.recordImport({ ...record.values, country: 'Germany' }, record);
    log.recordDelete(record);
    expect(log.page(1).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ customerId: 'CSV record 9', description: 'Row removed' }),
      ]),
    );
    expect(log.page(1).changes).toBe(2);
    expect(new ChangeLog().page(1)).toMatchObject({ changes: 0, groups: 0, total: 0 });
  });
  it('paginates individual entries and full ID lists without losing changes', () => {
    const log = new ChangeLog();
    for (let key = 0; key < 230; key++) {
      const record = row(key);
      log.recordImport({ ...record.values, country: 'Germany' }, record);
      log.recordEdit(record, { ...record.values, first_name: `Name ${key}` });
    }
    const page = log.page(1);
    expect(page.changes).toBe(460);
    expect(page.total).toBe(231);
    expect(page.items).toHaveLength(50);
    const group = page.items[0];
    expect(group.kind).toBe('group');
    if (group.kind !== 'group') {
      throw new Error('Expected a group');
    }
    expect(group.ids).toHaveLength(20);
    expect(group.count).toBe(230);
    expect(log.ids(group.key, 1).ids).toHaveLength(100);
    expect(log.ids(group.key, 3).ids).toHaveLength(30);
    expect(log.ids(group.key, 3).ids.at(-1)).toBe('C-230');
    expect(log.page(5).items).toHaveLength(31);
    expect(log.page(99).page).toBe(5);
  });
  it('invalidates grouped cache after new edits', () => {
    const log = new ChangeLog();
    const a = row(),
      b = row(1);
    log.recordEdit(a, { ...a.values, country: 'FR' });
    expect(log.page(1).groups).toBe(0);
    log.recordEdit(b, { ...b.values, country: 'FR' });
    expect(log.page(1).groups).toBe(1);
    expect(log.page(1).items[0]).toMatchObject({ kind: 'group', ids: ['C-1', 'C-2'] });
  });
});

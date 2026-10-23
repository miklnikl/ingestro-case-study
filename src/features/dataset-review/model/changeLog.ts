import { fields, type Field, type Row, type Values } from './types';

export type Change = {
  rowKey: number;
  customerId: string;
  source: 'import' | 'edit' | 'bulk' | 'delete' | 'undo' | 'restore';
  field?: Field;
  before?: string;
  after?: string;
};
export type HistoryItem =
  | { kind: 'group'; key: string; description: string; ids: string[]; count: number }
  | { kind: 'single'; key: string; description: string; customerId: string };
export type HistoryPage = {
  items: HistoryItem[];
  total: number;
  page: number;
  changes: number;
  groups: number;
};
export type HistoryIds = { groupKey: string; ids: string[]; total: number; page: number };
const PAGE_SIZE = 50;
const IDS_PAGE_SIZE = 100;
const PREVIEW_IDS = 20;
function description(change: Change) {
  if (change.source === 'restore') {
    return 'Row restored by undo';
  }
  if (change.source === 'delete') {
    return 'Row removed';
  }
  const prefix =
    change.source === 'import'
      ? 'Import formatting'
      : change.source === 'bulk'
        ? 'Bulk fix'
        : change.source === 'undo'
          ? 'Undo edit'
          : 'Manual edit';
  return `${prefix}: ${change.field!.replaceAll('_', ' ')} ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`;
}
function signature(change: Change) {
  return JSON.stringify([change.source, change.field, change.before, change.after]);
}
export class ChangeLog {
  private entries: Change[] = [];
  private identities = new Map<number, string>();
  private index: { groups: Map<string, Change[]>; singles: Change[] } | null = null;

  recordImport(original: Values, row: Row) {
    this.identities.set(row.key, original.customer_id.trim() || `CSV record ${row.key + 2}`);
    this.recordValues(row, original, row.values, 'import');
  }
  recordEdit(row: Row, next: Values) {
    this.recordValues(row, row.values, next, 'edit');
  }
  recordBulkEdit(row: Row, next: Values) {
    this.recordValues(row, row.values, next, 'bulk');
  }
  recordDelete(row: Row) {
    this.entries.push({ rowKey: row.key, customerId: this.identity(row), source: 'delete' });
    this.index = null;
  }
  recordUndoEdit(row: Row, next: Values) {
    this.recordValues(row, row.values, next, 'undo');
  }
  recordRestore(row: Row) {
    this.entries.push({ rowKey: row.key, customerId: this.identity(row), source: 'restore' });
    this.index = null;
  }
  matchesOriginalId(key: number, id: string) {
    return this.identities.get(key) === id;
  }
  private identity(row: Row) {
    return this.identities.get(row.key) ?? (row.values.customer_id || `CSV record ${row.key + 2}`);
  }
  private recordValues(
    row: Row,
    before: Values,
    after: Values,
    source: 'import' | 'edit' | 'bulk' | 'undo',
  ) {
    for (const field of fields) {
      if (before[field] !== after[field]) {
        this.entries.push({
          rowKey: row.key,
          customerId: this.identity(row),
          source,
          field,
          before: before[field],
          after: after[field],
        });
        this.index = null;
      }
    }
  }
  private getIndex() {
    if (this.index) {
      return this.index;
    }
    const bySignature = new Map<string, Change[]>();
    for (const entry of this.entries) {
      const key = signature(entry);
      const group = bySignature.get(key);
      if (group) {
        group.push(entry);
      } else {
        bySignature.set(key, [entry]);
      }
    }
    const groups = new Map<string, Change[]>();
    for (const [key, entries] of bySignature) {
      if (entries.some((entry) => entry.rowKey !== entries[0].rowKey)) {
        groups.set(key, entries);
      }
    }
    this.index = { groups, singles: this.entries.filter((entry) => !groups.has(signature(entry))) };
    return this.index;
  }
  page(requestedPage: number): HistoryPage {
    const { groups, singles } = this.getIndex();
    const total = groups.size + singles.length;
    const page = Math.max(1, Math.min(requestedPage, Math.ceil(total / PAGE_SIZE) || 1));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const items: HistoryItem[] = [];
    let position = 0;
    for (const [key, entries] of groups) {
      if (position >= end) {
        break;
      }
      if (position >= start) {
        items.push({
          kind: 'group',
          key,
          description: description(entries[0]),
          ids: entries.slice(0, PREVIEW_IDS).map((entry) => entry.customerId),
          count: entries.length,
        });
      }
      position++;
    }
    const singleStart = Math.max(0, start - groups.size);
    const singleEnd = Math.max(0, end - groups.size);
    singles.slice(singleStart, singleEnd).forEach((entry, index) => {
      items.push({
        kind: 'single',
        key: `single-${singleStart + index}`,
        description: description(entry),
        customerId: entry.customerId,
      });
    });
    return { items, total, page, changes: this.entries.length, groups: groups.size };
  }
  ids(groupKey: string, requestedPage: number): HistoryIds {
    const entries = this.getIndex().groups.get(groupKey) ?? [];
    const page = Math.max(
      1,
      Math.min(requestedPage, Math.ceil(entries.length / IDS_PAGE_SIZE) || 1),
    );
    return {
      groupKey,
      ids: entries
        .slice((page - 1) * IDS_PAGE_SIZE, page * IDS_PAGE_SIZE)
        .map((entry) => entry.customerId),
      total: entries.length,
      page,
    };
  }
}

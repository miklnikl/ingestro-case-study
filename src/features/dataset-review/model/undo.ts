import { fields, type Row, type Values } from './types';
export class UndoTransaction {
  private edits = new Map<number, Values>();
  private removed: Row[] = [];
  captureEdit(row: Row, next: Values) {
    if (!this.edits.has(row.key) && fields.some((field) => row.values[field] !== next[field])) {
      this.edits.set(row.key, { ...row.values });
    }
  }
  captureDelete(row: Row) {
    this.removed.push({ ...row, values: { ...row.values }, errors: { ...row.errors } });
  }
  get changed() {
    return this.edits.size > 0 || this.removed.length > 0;
  }
  restore(rows: Row[], onEdit: (row: Row, next: Values) => void, onRestore: (row: Row) => void) {
    for (const row of rows) {
      const next = this.edits.get(row.key);
      if (next) {
        onEdit(row, next);
        row.values = { ...next };
      }
    }
    for (const row of this.removed) {
      onRestore(row);
    }
    return this.removed.length ? [...rows, ...this.removed].sort((a, b) => a.key - b.key) : rows;
  }
}

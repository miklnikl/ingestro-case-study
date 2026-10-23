import Papa from 'papaparse';
import { fields, type Row, type Values } from '../model/types';
import { normalize } from '../model/normalize';
import { validateRows } from '../model/validateRows';

export function parseCsv(text: string, onRow?: (original: Values, row: Row) => void): Row[] {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) {
    const issue = parsed.errors[0];
    const location = typeof issue.row === 'number' ? ` at CSV record ${issue.row + 1}` : '';
    throw new Error(
      `Unsupported file format due to malformed CSV structure${location}: ${issue.message}. No rows were imported.`,
    );
  }
  const [header, ...data] = parsed.data;
  if (
    !header ||
    header.length !== fields.length ||
    new Set(header).size !== fields.length ||
    fields.some((f) => !header.includes(f))
  ) {
    const missing = fields.filter((field) => !header?.includes(field));
    const unexpected =
      header?.filter((field) => !fields.some((expected) => expected === field)) ?? [];
    const duplicates = header?.filter((field, index) => header.indexOf(field) !== index) ?? [];
    const details = [
      missing.length ? `missing columns: ${missing.join(', ')}` : '',
      unexpected.length ? `unexpected columns: ${unexpected.join(', ')}` : '',
      duplicates.length ? `duplicate columns: ${[...new Set(duplicates)].join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    throw new Error(
      `Unsupported file format due to incorrect columns (${details}). Expected exactly: ${fields.join(', ')}. No rows were imported.`,
    );
  }
  const indexes = fields.map((f) => header.indexOf(f));
  const rows = data.map((cells, key) => {
    if (cells.length !== header.length) {
      throw new Error(
        `Unsupported file format due to an incorrect number of cells at CSV record ${key + 2}: found ${cells.length}, expected ${header.length}. No rows were imported.`,
      );
    }
    const original = Object.fromEntries(fields.map((f, i) => [f, cells[indexes[i]]])) as Values;
    const values = normalize(original);
    const row = {
      key,
      values,
      errors: {},
      corrected: fields.some((f) => values[f] !== original[f]),
    };
    onRow?.(original, row);
    return row;
  });
  validateRows(rows);
  return rows;
}
export function exportCsv(rows: Row[]) {
  validateRows(rows);
  if (!rows.length || rows.some((r) => Object.keys(r.errors).length)) {
    throw new Error('Fix or remove every invalid row before exporting.');
  }
  return Papa.unparse(
    { fields: [...fields], data: rows.map((r) => fields.map((f) => r.values[f])) },
    { escapeFormulae: true },
  );
}

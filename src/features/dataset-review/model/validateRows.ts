import { schema } from './schema';
import type { Field, Row } from './types';

export function validateRows(rows: Row[]) {
  const ids = new Map<string, number>();
  const emails = new Map<string, number>();
  for (const row of rows) {
    for (const [field, map] of [
      ['customer_id', ids],
      ['email', emails],
    ] as const) {
      const value = row.values[field];
      if (value) {
        map.set(value, (map.get(value) ?? 0) + 1);
      }
    }
  }
  for (const row of rows) {
    row.errors = {};
    const result = schema.safeParse(row.values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        row.errors[issue.path[0] as Field] = issue.message;
      }
    }
    if ((ids.get(row.values.customer_id) ?? 0) > 1) {
      row.errors.customer_id = 'Duplicate customer ID: edit or remove this row.';
    }
    if ((emails.get(row.values.email) ?? 0) > 1) {
      row.errors.email = 'Duplicate email: edit or remove this row.';
    }
  }
}

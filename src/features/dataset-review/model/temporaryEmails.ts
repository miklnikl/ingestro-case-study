import { schema } from './schema';
export type TemporaryEmailScope = 'empty' | 'invalid';
import type { Row, Values } from './types';
export function generateTemporaryEmails(
  rows: Row[],
  expectedCount: number,
  onChange: (row: Row, next: Values) => void,
  scope: TemporaryEmailScope = 'empty',
) {
  const affected = rows.filter((row) =>
    scope === 'empty'
      ? row.values.email === ''
      : !schema.shape.email.safeParse(row.values.email).success,
  );
  if (!affected.length || affected.length !== expectedCount) {
    throw new Error(
      'The affected email count has changed. Review the updated count and try again.',
    );
  }
  const used = new Set(rows.map((row) => row.values.email.toLowerCase()));
  for (const row of affected) {
    const prefix = `temporary-${row.key + 1}`;
    let email = `${prefix}@example.invalid`;
    let suffix = 2;
    while (used.has(email.toLowerCase())) {
      email = `${prefix}-${suffix++}@example.invalid`;
    }
    used.add(email.toLowerCase());
    const next = { ...row.values, email };
    onChange(row, next);
    row.values = next;
  }
}

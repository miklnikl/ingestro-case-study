import { schema } from './schema';
import type { Row, Values } from './types';
export type NegativeSpendMode = 'positive' | 'zero';
export type NegativeSpendPreview = {
  count: number;
  samples: { customerId: string; before: string; positive: string }[];
};
export function positiveSpend(value: string): string | null {
  if (!/^-\d+(\.\d+)?$/.test(value) || !(Number(value) < 0)) {
    return null;
  }
  const positive = value.slice(1);
  return schema.shape.monthly_spend.safeParse(positive).success ? positive : null;
}
export function correctNegativeSpend(
  rows: Row[],
  mode: NegativeSpendMode,
  expectedCount: number,
  onChange: (row: Row, next: Values) => void,
) {
  const updates: { row: Row; value: string }[] = [];
  for (const row of rows) {
    if (!row.errors.monthly_spend) {
      continue;
    }
    const positive = positiveSpend(row.values.monthly_spend);
    if (positive !== null) {
      updates.push({ row, value: mode === 'positive' ? positive : '0' });
    }
  }
  if (!updates.length || updates.length !== expectedCount) {
    throw new Error(
      'The negative spend count has changed. Review the updated preview and try again.',
    );
  }
  for (const { row, value } of updates) {
    const next = { ...row.values, monthly_spend: value };
    onChange(row, next);
    row.values = next;
  }
}

import { schema } from './schema';
import type { Field, Row, Values } from './types';
import { replacementValue } from './issueResolution';
export type IssueValueOption = { value: string; count: number; customerIds: string[] };
export type IssueValuePage = {
  field: Field;
  search: string;
  limit: number;
  total: number;
  options: IssueValueOption[];
};
export function listIssueValues(
  rows: Row[],
  field: Field,
  search: string,
  limit: number,
): IssueValuePage {
  const counts = new Map<string, number>();
  const needle = search.toLowerCase();
  for (const row of rows) {
    const value = row.values[field];
    if (
      !row.errors[field] ||
      (field === 'email' && (!value || schema.shape.email.safeParse(value).success))
    ) {
      continue;
    }
    if ((value || '(empty)').toLowerCase().includes(needle)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const options = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count, customerIds: [] as string[] }));
  const selected = new Map(options.map((option) => [option.value, option]));
  for (const row of rows) {
    if (!row.errors[field]) {
      continue;
    }
    const option = selected.get(row.values[field]);
    if (option && option.customerIds.length < 3) {
      option.customerIds.push(row.values.customer_id || `CSV record ${row.key + 2}`);
    }
  }
  return { field, search, limit, total: counts.size, options };
}
export function replaceIssueValue(
  rows: Row[],
  field: Field,
  source: string,
  input: string,
  expectedCount: number,
  onChange: (row: Row, next: Values) => void,
) {
  const parsed = replacementValue(field, input, true);
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  const affected = rows.filter((row) => row.errors[field] && row.values[field] === source);
  if (affected.length !== expectedCount || !affected.length) {
    throw new Error(
      'The selected value group has changed. Select it again and review the updated count.',
    );
  }
  if (field === 'email' || field === 'customer_id') {
    if (affected.length > 1) {
      throw new Error(
        'Replacing multiple records with the same email or customer ID would create duplicates. Correct these cells individually or use the duplicate-removal options.',
      );
    }
    if (rows.some((row) => row !== affected[0] && row.values[field] === parsed.value)) {
      throw new Error(
        'This email or customer ID is already used by another record. Choose a unique value.',
      );
    }
  }
  for (const row of affected) {
    const next = { ...row.values, [field]: parsed.value };
    onChange(row, next);
    row.values = next;
  }
}

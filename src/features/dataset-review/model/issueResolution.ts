import { positiveSpend, type NegativeSpendPreview } from './negativeSpend';
import { nearestValidDate, type DateCorrectionPreview } from './dateCorrection';
import { fields, type Field, type Row, type Values } from './types';
import { normalize } from './normalize';
import { schema } from './schema';
export type IssueScope = 'empty' | 'invalid';
export type IssueSample = { customerId: string; value: string };
export type IssueGroup = {
  field: Field;
  count: number;
  invalidEmailCount?: number;
  dateCorrections?: DateCorrectionPreview;
  negativeSpend?: NegativeSpendPreview;
  empty: number;
  invalid: number;
  samples: Record<IssueScope, IssueSample[]>;
};
export const supportsBulkReplacement = (field: Field) =>
  field !== 'email' && field !== 'customer_id';
export function replacementValue(field: Field, input: string, allowUnique = false) {
  if (!allowUnique && !supportsBulkReplacement(field)) {
    return {
      success: false as const,
      error: 'Whole-category replacement is unavailable for email and customer IDs.',
    };
  }
  const values = Object.fromEntries(
    fields.map((key) => [key, key === field ? input : '']),
  ) as Values;
  const value = normalize(values)[field];
  const result = schema.shape[field].safeParse(value);
  return result.success
    ? { success: true as const, value }
    : { success: false as const, error: result.error.issues[0].message };
}
export function matchesIssue(row: Row, field: Field, scope?: IssueScope) {
  return (
    !!row.errors[field] &&
    (!scope || (scope === 'empty' ? row.values[field] === '' : row.values[field] !== ''))
  );
}
export function collectIssueGroups(rows: Row[]): IssueGroup[] {
  const groups = new Map<Field, IssueGroup>();
  for (const row of rows) {
    for (const field of fields) {
      if (!row.errors[field]) {
        continue;
      }
      let group = groups.get(field);
      if (!group) {
        group = { field, count: 0, empty: 0, invalid: 0, samples: { empty: [], invalid: [] } };
        groups.set(field, group);
      }
      const scope = row.values[field] === '' ? 'empty' : 'invalid';
      group.count++;
      if (field === 'email' && !schema.shape.email.safeParse(row.values.email).success) {
        group.invalidEmailCount = (group.invalidEmailCount ?? 0) + 1;
      }
      if (field === 'signup_date') {
        group.dateCorrections ??= {
          earlier: { count: 0, samples: [] },
          later: { count: 0, samples: [] },
        };
        for (const direction of ['earlier', 'later'] as const) {
          const after = nearestValidDate(row.values.signup_date, direction);
          if (after === null) {
            continue;
          }
          const preview = group.dateCorrections[direction];
          preview.count++;
          if (preview.samples.length < 3) {
            preview.samples.push({
              customerId: row.values.customer_id || `CSV record ${row.key + 2}`,
              before: row.values.signup_date,
              after,
            });
          }
        }
      }
      if (field === 'monthly_spend') {
        group.negativeSpend ??= { count: 0, samples: [] };
        const positive = positiveSpend(row.values.monthly_spend);
        if (positive !== null) {
          group.negativeSpend.count++;
          if (group.negativeSpend.samples.length < 3) {
            group.negativeSpend.samples.push({
              customerId: row.values.customer_id || `CSV record ${row.key + 2}`,
              before: row.values.monthly_spend,
              positive,
            });
          }
        }
      }
      group[scope]++;
      if (group.samples[scope].length < 3) {
        group.samples[scope].push({
          customerId: row.values.customer_id || `CSV record ${row.key + 2}`,
          value: row.values[field],
        });
      }
    }
  }
  return [...groups.values()];
}
function assertCount(actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error('The issue group has changed. Review the updated count and try again.');
  }
  if (!actual) {
    throw new Error('No matching issues remain.');
  }
}
export function replaceIssueValues(
  rows: Row[],
  field: Field,
  scope: IssueScope,
  input: string,
  expectedCount: number,
  onChange: (row: Row, next: Values) => void,
) {
  const parsed = replacementValue(field, input);
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  const affected = rows.filter((row) => matchesIssue(row, field, scope));
  assertCount(affected.length, expectedCount);
  for (const row of affected) {
    const next = { ...row.values, [field]: parsed.value };
    onChange(row, next);
    row.values = next;
  }
}
export function removeIssueRows(
  rows: Row[],
  field: Field,
  expectedCount: number,
  onRemove: (row: Row) => void,
) {
  const affected = rows.filter((row) => matchesIssue(row, field));
  assertCount(affected.length, expectedCount);
  for (const row of affected) {
    onRemove(row);
  }
  return rows.filter((row) => !matchesIssue(row, field));
}

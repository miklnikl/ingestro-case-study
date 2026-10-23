import { supportsBulkReplacement } from './issueResolution';
import { schema } from './schema';
import type { Field, Row } from './types';
export type EditPropagationSuggestion = {
  id: number;
  rowKey: number;
  field: Field;
  source: string;
  value: string;
  count: number;
  customerIds: string[];
};
export function suggestEditPropagation(
  rows: Row[],
  field: Field,
  source: string,
  value: string,
  wasInvalid: boolean,
): Omit<EditPropagationSuggestion, 'id' | 'rowKey'> | null {
  if (
    !wasInvalid ||
    !supportsBulkReplacement(field) ||
    source === value ||
    !schema.shape[field].safeParse(value).success
  ) {
    return null;
  }
  let count = 0;
  const customerIds: string[] = [];
  for (const row of rows) {
    if (row.errors[field] && row.values[field] === source) {
      count++;
      if (customerIds.length < 3) {
        customerIds.push(row.values.customer_id || `CSV record ${row.key + 2}`);
      }
    }
  }
  return count ? { field, source, value, count, customerIds } : null;
}

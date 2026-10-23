import { realDate } from './schema';
import type { Row } from './types';
export type EmailKeepOrder = 'earliest' | 'latest';
export type EmailDuplicateSummary = { groups: number; removable: number };
export function emailDuplicateSummary(rows: Row[]): EmailDuplicateSummary {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const email = row.values.email;
    if (email) {
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }
  }
  let groups = 0,
    removable = 0;
  for (const count of counts.values()) {
    if (count > 1) {
      groups++;
      removable += count - 1;
    }
  }
  return { groups, removable };
}
function prefer(candidate: Row, current: Row, order: EmailKeepOrder) {
  const a = candidate.values.signup_date,
    b = current.values.signup_date;
  const aValid = realDate(a),
    bValid = realDate(b);
  if (aValid !== bValid) {
    return aValid;
  }
  if (aValid && a !== b) {
    return order === 'earliest' ? a < b : a > b;
  }
  return candidate.key < current.key;
}
export function deduplicateEmails(
  rows: Row[],
  order: EmailKeepOrder,
  expectedCount: number,
  onRemove: (row: Row) => void,
) {
  const keepers = new Map<string, Row>();
  for (const row of rows) {
    const email = row.values.email;
    if (!email) {
      continue;
    }
    const current = keepers.get(email);
    if (!current || prefer(row, current, order)) {
      keepers.set(email, row);
    }
  }
  const removed = rows.filter((row) => row.values.email && keepers.get(row.values.email) !== row);
  if (removed.length !== expectedCount) {
    throw new Error('Duplicate emails have changed. Review the updated count and try again.');
  }
  if (!removed.length) {
    throw new Error('No duplicate emails remain.');
  }
  for (const row of removed) {
    onRemove(row);
  }
  return rows.filter((row) => !row.values.email || keepers.get(row.values.email) === row);
}

import { realDate } from './schema';
import type { Row, Values } from './types';
export type DateDirection = 'earlier' | 'later';
export type DateCorrectionPreview = Record<
  DateDirection,
  { count: number; samples: { customerId: string; before: string; after: string }[] }
>;
function daysInMonth(year: number, month: number) {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function formatDate(year: number, month: number, day: number) {
  if (year < 0 || year > 9999) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function nearestValidDate(value: string, direction: DateDirection): string | null {
  if (realDate(value)) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  if (month < 1 || month > 12) {
    return null;
  }
  const lastDay = daysInMonth(year, month);
  if (day > lastDay) {
    return direction === 'earlier'
      ? formatDate(year, month, lastDay)
      : formatDate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1);
  }
  if (day === 0) {
    const previousYear = month === 1 ? year - 1 : year,
      previousMonth = month === 1 ? 12 : month - 1;
    return direction === 'later'
      ? formatDate(year, month, 1)
      : formatDate(previousYear, previousMonth, daysInMonth(previousYear, previousMonth));
  }
  return null;
}
export function correctInvalidDates(
  rows: Row[],
  direction: DateDirection,
  expectedCount: number,
  onChange: (row: Row, next: Values) => void,
) {
  const updates: { row: Row; value: string }[] = [];
  for (const row of rows) {
    if (!row.errors.signup_date) {
      continue;
    }
    const value = nearestValidDate(row.values.signup_date, direction);
    if (value !== null) {
      updates.push({ row, value });
    }
  }
  if (!updates.length || updates.length !== expectedCount) {
    throw new Error(
      'The correctable date count has changed. Review the updated preview and try again.',
    );
  }
  for (const { row, value } of updates) {
    const next = { ...row.values, signup_date: value };
    onChange(row, next);
    row.values = next;
  }
}

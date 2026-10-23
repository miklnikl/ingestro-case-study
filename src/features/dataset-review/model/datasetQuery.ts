import { realDate } from './schema';
import { fields, type Row } from './types';
import type { Query } from './protocol';
export function readDatasetQuery(search: string): Query {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  return {
    search: params.get('q') ?? '',
    onlyErrors: params.get('issues') === '1',
    limit: 500,
    country: params.has('country') ? params.get('country')! : undefined,
    plan: params.has('plan') ? params.get('plan')! : undefined,
    id: params.get('id') || undefined,
    sort: sort === 'signup_date' || sort === 'monthly_spend' ? sort : undefined,
    order: params.get('order') === 'desc' ? 'desc' : 'asc',
  };
}
export function datasetQuerySearch(query: Query, currentSearch = '') {
  const params = new URLSearchParams(currentSearch);
  for (const key of ['q', 'issues', 'country', 'plan', 'id', 'sort', 'order']) {
    params.delete(key);
  }
  if (query.search) {
    params.set('q', query.search);
  }
  if (query.onlyErrors) {
    params.set('issues', '1');
  }
  if (query.country !== undefined) {
    params.set('country', query.country);
  }
  if (query.plan !== undefined) {
    params.set('plan', query.plan);
  }
  if (query.id) {
    params.set('id', query.id);
  }
  if (query.sort) {
    params.set('sort', query.sort);
    params.set('order', query.order === 'desc' ? 'desc' : 'asc');
  }
  return params.size ? `?${params.toString()}` : '';
}
export function recordHref(id: string, currentSearch = '') {
  return `${datasetQuerySearch({ search: '', onlyErrors: false, limit: 500, id }, currentSearch)}#/`;
}
function sortableSpend(value: string) {
  return /^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}
export function queryDataset(
  rows: Row[],
  query: Query,
  matchesOriginalId: (key: number, id: string) => boolean = () => false,
) {
  const needle = query.search.toLowerCase();
  const matching = rows.filter(
    (row) =>
      (!query.onlyErrors || Object.keys(row.errors).length > 0) &&
      (query.country === undefined || row.values.country === query.country) &&
      (query.plan === undefined || row.values.plan === query.plan) &&
      (!query.id || row.values.customer_id === query.id || matchesOriginalId(row.key, query.id)) &&
      (!needle || fields.some((field) => row.values[field].toLowerCase().includes(needle))),
  );
  if (query.sort) {
    const field = query.sort,
      direction = query.order === 'desc' ? -1 : 1;
    // Cache parsed values once per row; comparator work stays constant-time.
    const values = new Map(
      matching.map((row) => [
        row.key,
        field === 'signup_date'
          ? realDate(row.values[field])
            ? row.values[field]
            : null
          : sortableSpend(row.values[field]),
      ]),
    );
    matching.sort((a, b) => {
      const av = values.get(a.key) ?? null,
        bv = values.get(b.key) ?? null;
      if (av === null || bv === null) {
        return av === bv ? a.key - b.key : av === null ? 1 : -1;
      }
      return (av < bv ? -1 : av > bv ? 1 : 0) * direction || a.key - b.key;
    });
  }
  return matching;
}
export function datasetFilterOptions(rows: Row[]) {
  const countries = new Map<string, number>(),
    plans = new Map<string, number>();
  for (const row of rows) {
    countries.set(row.values.country, (countries.get(row.values.country) ?? 0) + 1);
    plans.set(row.values.plan, (plans.get(row.values.plan) ?? 0) + 1);
  }
  const ordered = (counts: Map<string, number>) =>
    [...counts].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  return { countries: ordered(countries), plans: ordered(plans) };
}

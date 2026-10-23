import { Input, Select, Space, Switch, Tag, Typography } from 'antd';
import { RecordLink } from './RecordLink';
import type { Query } from '../model/protocol';
type Props = {
  search: string;
  setSearch: (value: string) => void;
  onlyErrors: boolean;
  busy: boolean;
  filterIssues: (value: boolean) => void;
  fileName: string;
  query: Query;
  filterOptions: { countries: string[]; plans: string[] };
  onFilterChange: (
    patch: Partial<Pick<Query, 'country' | 'plan' | 'id' | 'sort' | 'order'>>,
  ) => void;
};
export function DatasetToolbar({
  search,
  setSearch,
  onlyErrors,
  busy,
  filterIssues,
  fileName,
  query,
  filterOptions,
  onFilterChange,
}: Props) {
  return (
    <div className="toolbar">
      <Input.Search
        placeholder="Search all columns"
        aria-label="Search all columns"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 360 }}
      />
      <Select
        aria-label="Filter by country"
        placeholder="All countries"
        allowClear
        showSearch
        disabled={busy}
        value={query.country}
        onChange={(country) => onFilterChange({ country })}
        options={filterOptions.countries.map((value) => ({ value, label: value || '(empty)' }))}
        style={{ minWidth: 150 }}
      />
      <Select
        aria-label="Filter by plan"
        placeholder="All plans"
        allowClear
        showSearch
        disabled={busy}
        value={query.plan}
        onChange={(plan) => onFilterChange({ plan })}
        options={filterOptions.plans.map((value) => ({ value, label: value || '(empty)' }))}
        style={{ minWidth: 150 }}
      />
      <Select
        aria-label="Sort records"
        placeholder="Original order"
        allowClear
        disabled={busy}
        value={query.sort ? `${query.sort}:${query.order ?? 'asc'}` : undefined}
        onChange={(value) => {
          const [field, order] = value?.split(':') ?? [];
          onFilterChange({
            sort: field === 'signup_date' || field === 'monthly_spend' ? field : undefined,
            order: order === 'desc' ? 'desc' : 'asc',
          });
        }}
        options={[
          { value: 'signup_date:asc', label: 'Date: oldest first' },
          { value: 'signup_date:desc', label: 'Date: newest first' },
          { value: 'monthly_spend:asc', label: 'Spend: low to high' },
          { value: 'monthly_spend:desc', label: 'Spend: high to low' },
        ]}
        style={{ minWidth: 190 }}
      />
      {query.id && (
        <Tag closable onClose={() => onFilterChange({ id: undefined })}>
          Record ID: <RecordLink id={query.id} />
        </Tag>
      )}
      <Space>
        <Switch
          checked={onlyErrors}
          disabled={busy}
          onChange={filterIssues}
          aria-label="Show rows with issues only"
        />
        Issues only
      </Space>
      <Typography.Text type="secondary">{fileName}</Typography.Text>
    </div>
  );
}

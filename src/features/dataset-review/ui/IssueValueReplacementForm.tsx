import { RecordLink } from './RecordLink';
import { useState } from 'react';
import { Alert, Button, Popconfirm, Select, Typography } from 'antd';
import type { Field } from '../model/types';
import type { IssueValuePage } from '../model/issueValues';
import { replacementValue } from '../model/issueResolution';
import { IssueReplacementInput } from './IssueReplacementInput';
type Props = {
  field: Field;
  busy: boolean;
  options: IssueValuePage | null;
  loading: boolean;
  error: string;
  onLoad: (search: string, limit: number) => void;
  onReplace: (source: string, value: string, count: number) => void;
};
export function IssueValueReplacementForm({
  field,
  busy,
  options,
  loading,
  error,
  onLoad,
  onReplace,
}: Props) {
  const [source, setSource] = useState<string>();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const label = field.replaceAll('_', ' ');
  const selected = options?.options.find(
    (option) => `value:${JSON.stringify(option.value)}` === source,
  );
  const parsed = replacementValue(field, input, true);
  const value = parsed.success ? parsed.value : '';
  const uniqueConflict =
    (field === 'email' || field === 'customer_id') && !!selected && selected.count > 1;
  const disabled = busy || loading || !selected?.count || !parsed.success || uniqueConflict;
  return (
    <section className="issue-replacement">
      <Typography.Text strong>Replace a specific invalid value</Typography.Text>
      <Select
        aria-label={`Invalid ${label} value`}
        placeholder="Choose an invalid value"
        showSearch
        filterOption={false}
        value={selected ? `value:${JSON.stringify(selected.value)}` : undefined}
        disabled={busy}
        loading={loading}
        options={
          options?.options.map((option) => ({
            value: `value:${JSON.stringify(option.value)}`,
            label: `${option.value === '' ? '(empty)' : JSON.stringify(option.value)} (${option.count.toLocaleString()})`,
          })) ?? []
        }
        onOpenChange={(open) => {
          if (open) {
            setSearch('');
            onLoad('', 50);
          }
        }}
        onSearch={(text) => {
          setSearch(text);
          onLoad(text, 50);
        }}
        onChange={setSource}
        onPopupScroll={(event) => {
          const element = event.currentTarget;
          if (
            !loading &&
            options &&
            options.options.length < options.total &&
            element.scrollHeight - element.scrollTop - element.clientHeight < 100
          ) {
            onLoad(search, options.limit + 50);
          }
        }}
      />
      {error && <Alert type="error" message={error} />}
      <IssueReplacementInput
        field={field}
        value={input}
        onChange={setInput}
        busy={busy}
        label={`New value for selected ${label}`}
      />
      {input && !parsed.success && <Alert type="error" message={parsed.error} />}
      {uniqueConflict && (
        <Alert
          type="warning"
          message="Applying the same email or customer ID to multiple records would create duplicates. Edit these cells individually or use duplicate removal."
        />
      )}
      {selected && (
        <>
          <Typography.Text>
            {selected.count.toLocaleString()} matching records.
            {selected.customerIds.length > 0 ? ' Examples:' : ''}
          </Typography.Text>
          <ul className="issue-samples">
            {selected.customerIds.map((id, index) => (
              <li key={index}>
                <RecordLink id={id} />: <code>{JSON.stringify(selected.value)}</code>
                {parsed.success && (
                  <>
                    {' '}
                    → <code>{JSON.stringify(value)}</code>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <Popconfirm
        disabled={disabled}
        title={`Replace ${JSON.stringify(selected?.value)} with ${JSON.stringify(value)}?`}
        description={`Only the ${selected?.count.toLocaleString() ?? 0} records with this invalid ${label} value will change, across the entire dataset.`}
        okText="Replace matching values"
        onConfirm={() => {
          if (selected && parsed.success) {
            onReplace(selected.value, value, selected.count);
            setSource(undefined);
          }
        }}
      >
        <Button type="primary" disabled={disabled}>
          Replace matching values{selected ? ` (${selected.count.toLocaleString()})` : ''}
        </Button>
      </Popconfirm>
    </section>
  );
}

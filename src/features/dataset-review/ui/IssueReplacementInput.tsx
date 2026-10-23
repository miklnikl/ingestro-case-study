import { Button, Input, Select, Space } from 'antd';
import type { Field } from '../model/types';
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function IssueReplacementInput({
  field,
  value,
  onChange,
  busy,
  label,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  label: string;
}) {
  return (
    <Space.Compact block>
      {field === 'plan' ? (
        <Select
          aria-label={label}
          placeholder="Choose a plan"
          value={value || undefined}
          disabled={busy}
          onChange={onChange}
          options={['free', 'pro', 'enterprise'].map((value) => ({ value, label: value }))}
          style={{ width: '100%' }}
        />
      ) : (
        <Input
          aria-label={label}
          disabled={busy}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={field === 'signup_date' ? 'date' : field === 'monthly_spend' ? 'number' : 'text'}
          min={field === 'monthly_spend' ? 0 : undefined}
          step={field === 'monthly_spend' ? 'any' : undefined}
          placeholder={field === 'country' ? 'ISO code, e.g. DE' : 'Replacement value'}
        />
      )}
      {field === 'signup_date' && (
        <Button disabled={busy} onClick={() => onChange(today())}>
          Use today
        </Button>
      )}
      {field === 'monthly_spend' && (
        <Button disabled={busy} onClick={() => onChange('0')}>
          Use 0
        </Button>
      )}
    </Space.Compact>
  );
}

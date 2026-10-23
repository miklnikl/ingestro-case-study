import { RecordLinks } from './RecordLink';
import { Button, Space, Typography } from 'antd';
import type { EditPropagationSuggestion } from '../model/editPropagation';
type Props = {
  suggestion: EditPropagationSuggestion;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
};
export function EditPropagationPrompt({ suggestion, busy, onApply, onDismiss }: Props) {
  const label = suggestion.field.replaceAll('_', ' ');
  return (
    <Space direction="vertical" style={{ width: 'min(360px, calc(100vw - 48px))' }}>
      <Typography.Text strong>
        Apply this correction to {suggestion.count.toLocaleString()} other invalid {label} values?
      </Typography.Text>
      <Typography.Text>
        {JSON.stringify(suggestion.source)} → {JSON.stringify(suggestion.value)}
      </Typography.Text>
      <Typography.Text type="secondary">
        Only invalid cells with this exact value in this column will change, including rows hidden
        by filters. Example IDs: <RecordLinks ids={suggestion.customerIds} />.
      </Typography.Text>
      <Space wrap>
        <Button type="primary" disabled={busy} onClick={onApply}>
          Apply to {suggestion.count.toLocaleString()} matching cells
        </Button>
        <Button disabled={busy} onClick={onDismiss}>
          Not now
        </Button>
      </Space>
    </Space>
  );
}

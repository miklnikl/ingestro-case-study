import { useState } from 'react';
import { Input, Tooltip } from 'antd';

type Props = {
  value: string;
  error?: string;
  label: string;
  editLabel: string;
  onSave: (value: string) => void;
};
export function EditableCell({ value, error, label, editLabel, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };
  if (editing) {
    return (
      <Input
        autoFocus
        size="small"
        aria-label={editLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPressEnter={(e) => e.currentTarget.blur()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <Tooltip title={error ?? 'Click to edit'}>
      <button
        className={`cell ${error ? 'invalid' : ''}`}
        aria-label={label}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {error && <span aria-hidden="true">⚠ </span>}
        {value || '—'}
      </button>
    </Tooltip>
  );
}

import { useRef } from 'react';
import { EditableCell } from '../../../shared/ui/EditableCell';
import type { Field, Row } from '../model/types';
export type CellEditAnchor = {
  rowKey: number;
  field: Field;
  rect: { left: number; top: number; width: number; height: number };
};
type Props = {
  row: Row;
  field: Field;
  onEdit: (key: number, field: Field, value: string, anchor: CellEditAnchor) => void;
};
export function DatasetEditableCell({ row, field, onEdit }: Props) {
  const wrapper = useRef<HTMLSpanElement>(null);
  return (
    <span ref={wrapper} style={{ display: 'block' }}>
      <EditableCell
        value={row.values[field]}
        error={row.errors[field]}
        label={`${field}: ${row.values[field] || 'empty'}${row.errors[field] ? `. ${row.errors[field]}` : ''}`}
        editLabel={`Edit ${field} for row ${row.key + 1}`}
        onSave={(value) => {
          const rect = wrapper.current?.getBoundingClientRect();
          if (rect) {
            onEdit(row.key, field, value, {
              rowKey: row.key,
              field,
              rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            });
          }
        }}
      />
    </span>
  );
}

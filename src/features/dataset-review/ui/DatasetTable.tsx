import { useState } from 'react';
import { DatasetEditableCell, type CellEditAnchor } from './DatasetEditableCell';
import { EditPropagationPopover } from './EditPropagationPopover';
import { Button, Popconfirm, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fields, type Row } from '../model/types';
import type { DatasetReviewController } from '../model/useDatasetReview';
import type { Result } from '../model/protocol';
type Props = Pick<
  DatasetReviewController,
  | 'tableRef'
  | 'busy'
  | 'edit'
  | 'remove'
  | 'loadMore'
  | 'editSuggestion'
  | 'applyEditSuggestion'
  | 'dismissEditSuggestion'
> & {
  result: Result;
};
export function DatasetTable({
  tableRef,
  busy,
  edit,
  remove,
  loadMore,
  result,
  editSuggestion,
  applyEditSuggestion,
  dismissEditSuggestion,
}: Props) {
  const [editAnchor, setEditAnchor] = useState<CellEditAnchor | null>(null);
  const columns: ColumnsType<Row> = fields.map((field) => ({
    title: field.replaceAll('_', ' '),
    dataIndex: field,
    key: field,
    width: field === 'email' ? 270 : 170,
    render: (_, row) => (
      <DatasetEditableCell
        row={row}
        field={field}
        onEdit={(key, field, value, anchor) => {
          setEditAnchor(anchor);
          edit(key, field, value);
        }}
      />
    ),
  }));
  columns.push({
    title: '',
    key: 'actions',
    width: 90,
    render: (_, row) => (
      <Popconfirm
        title="Remove this row?"
        description="Use Undo last change to restore these records before making another change."
        onConfirm={() => remove(row.key)}
      >
        <Button danger type="text" size="small" disabled={busy}>
          Remove
        </Button>
      </Popconfirm>
    ),
  });
  return (
    <>
      <Table<Row>
        ref={tableRef}
        virtual
        columns={columns}
        dataSource={result.rows}
        rowKey="key"
        pagination={false}
        size="small"
        scroll={{ x: 1550, y: 520 }}
        loading={busy}
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 250) {
            loadMore();
          }
        }}
      />
      <EditPropagationPopover
        anchor={editAnchor}
        suggestion={editSuggestion}
        busy={busy}
        onApply={applyEditSuggestion}
        onDismiss={dismissEditSuggestion}
      />
      <footer>
        <span>
          {result.rows.length.toLocaleString()} of {result.matching.toLocaleString()} matching rows
          loaded · Scroll to load more
        </span>
        <span>Click a cell to edit · Enter to save · Esc to cancel</span>
      </footer>
    </>
  );
}

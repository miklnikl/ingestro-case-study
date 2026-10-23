import { RecordLink, RecordLinks } from './RecordLink';
import { Button, Table, Typography } from 'antd';
import type { HistoryItem, HistoryPage } from '../model/changeLog';

type Props = {
  history: HistoryPage;
  busy: boolean;
  onPageChange: (page: number) => void;
  onShowIds: (groupKey: string, description: string) => void;
};
export function ChangeHistoryTable({ history, busy, onPageChange, onShowIds }: Props) {
  return (
    <Table<HistoryItem>
      rowKey="key"
      dataSource={history.items}
      loading={busy}
      pagination={{
        current: history.page,
        pageSize: 50,
        total: history.total,
        showSizeChanger: false,
        onChange: onPageChange,
      }}
      columns={[
        {
          title: 'Changes',
          key: 'description',
          render: (_, item) =>
            item.kind === 'group' ? (
              <div className="history-entry">
                <Typography.Text strong>{item.description}</Typography.Text> — [
                <span className="history-ids">
                  <RecordLinks ids={item.ids} />
                </span>
                {item.count > item.ids.length ? ', …' : ''}]
                {item.count > item.ids.length && (
                  <Button type="link" onClick={() => onShowIds(item.key, item.description)}>
                    Show all {item.count.toLocaleString()} IDs
                  </Button>
                )}
              </div>
            ) : (
              <div className="history-entry">
                <RecordLink id={item.customerId} /> — {item.description}
              </div>
            ),
        },
      ]}
    />
  );
}

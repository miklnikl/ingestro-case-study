import { RecordLink } from './RecordLink';
import { Alert, List, Modal } from 'antd';
import type { HistoryIds } from '../model/changeLog';
type Props = {
  group: { key: string; description: string } | null;
  data: HistoryIds | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onPageChange: (page: number) => void;
};
export function ChangeGroupIds({ group, data, busy, error, onClose, onPageChange }: Props) {
  const current = data?.groupKey === group?.key ? data : null;
  return (
    <Modal open={!!group} title={group?.description} onCancel={onClose} footer={null} width={640}>
      {error && <Alert type="error" message={error} />}
      <List
        loading={busy}
        dataSource={current?.ids ?? []}
        pagination={{
          current: current?.page ?? 1,
          pageSize: 100,
          total: current?.total ?? 0,
          showSizeChanger: false,
          onChange: onPageChange,
        }}
        renderItem={(id) => (
          <List.Item>
            <RecordLink id={id} />
          </List.Item>
        )}
      />
    </Modal>
  );
}

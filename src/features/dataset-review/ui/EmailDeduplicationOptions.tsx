import { Button, Popconfirm, Space, Typography } from 'antd';
import type { EmailDuplicateSummary, EmailKeepOrder } from '../model/emailDeduplication';
type Props = {
  summary: EmailDuplicateSummary;
  busy: boolean;
  onDeduplicate: (order: EmailKeepOrder, expectedCount: number) => void;
};
export function EmailDeduplicationOptions({ summary, busy, onDeduplicate }: Props) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Typography.Text strong>
        Duplicate emails: {summary.groups.toLocaleString()} groups
      </Typography.Text>
      <Typography.Paragraph>
        Keep one record per exact email by signup date. Valid dates take priority. Equal dates or
        groups without a valid date keep the first record in the original file. Empty emails are not
        deduplicated; invalid email values still require correction.
      </Typography.Paragraph>
      {(['earliest', 'latest'] as const).map((order) => (
        <Popconfirm
          key={order}
          title={`Keep the ${order} record and remove ${summary.removable.toLocaleString()} duplicates?`}
          description={`One record will remain in each of ${summary.groups.toLocaleString()} email groups. Entire duplicate records will be removed. Use Undo last change to restore these records before making another change.`}
          okText="Remove duplicates"
          okButtonProps={{ danger: true }}
          disabled={busy || !summary.removable}
          onConfirm={() => onDeduplicate(order, summary.removable)}
        >
          <Button disabled={busy || !summary.removable}>Keep {order} by signup date</Button>
        </Popconfirm>
      ))}
    </Space>
  );
}

import { Alert, Button, Space, Tag } from 'antd';
export function DatasetIssues({
  counts,
  onFix,
  busy,
}: {
  counts: Record<string, number>;
  onFix: () => void;
  busy: boolean;
}) {
  return (
    <Alert
      type="warning"
      showIcon
      action={
        <Button onClick={onFix} disabled={busy}>
          Fix issues
        </Button>
      }
      message="Export is locked until every row is valid."
      description={
        <Space wrap>
          {Object.entries(counts).map(([field, count]) => (
            <Tag key={field}>
              {field.replaceAll('_', ' ')}: {count.toLocaleString()}
            </Tag>
          ))}
        </Space>
      }
    />
  );
}

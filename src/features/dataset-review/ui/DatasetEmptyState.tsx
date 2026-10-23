import { Empty, Spin, Typography, Upload } from 'antd';
export function DatasetEmptyState({
  busy,
  upload,
}: {
  busy: boolean;
  upload: (file: File) => false;
}) {
  return (
    <section className="empty">
      {busy ? (
        <Spin size="large" tip="Reading and validating CSV…">
          <div style={{ height: 100 }} />
        </Spin>
      ) : (
        <Empty>
          <Upload.Dragger accept=".csv,text/csv" beforeUpload={upload} showUploadList={false}>
            <Typography.Title level={5}>Drop a CSV here or click to browse</Typography.Title>
            <Typography.Text type="secondary">Processing stays in your browser</Typography.Text>
          </Upload.Dragger>
        </Empty>
      )}
    </section>
  );
}

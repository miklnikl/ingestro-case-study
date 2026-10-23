import { Button, Popconfirm, Space, Typography, Upload } from 'antd';

type Props = {
  busy: boolean;
  hasDataset: boolean;
  canClear: boolean;
  canExport: boolean;
  canUndo: boolean;
  undo: () => void;
  upload: (file: File) => false;
  clear: () => void;
  exportFile: () => void;
};
export function DatasetHeader({
  busy,
  hasDataset,
  canClear,
  canExport,
  canUndo,
  undo,
  upload,
  clear,
  exportFile,
}: Props) {
  return (
    <header>
      <div>
        <Typography.Title level={3}>Dataset review</Typography.Title>
        <Typography.Text type="secondary">Review and correct your customer data</Typography.Text>
      </div>
      <Space wrap>
        {hasDataset ? (
          <Button type="primary" disabled={busy || !canExport} onClick={exportFile}>
            Save CSV
          </Button>
        ) : (
          <Upload
            accept=".csv,text/csv"
            showUploadList={false}
            beforeUpload={(file) => {
              upload(file);
              return false;
            }}
            disabled={busy}
          >
            <Button type="primary" disabled={busy}>
              Upload CSV
            </Button>
          </Upload>
        )}
        <Button disabled={busy || !canUndo} onClick={undo}>
          Undo last change
        </Button>
        <Popconfirm title="Clear all loaded data?" onConfirm={clear}>
          <Button disabled={!canClear}>Clear</Button>
        </Popconfirm>
      </Space>
    </header>
  );
}

import { useEffect, useState } from 'react';
import { Alert, Empty, Spin, Typography } from 'antd';
import {
  ChangeHistoryTable,
  ChangeGroupIds,
  type DatasetReviewController,
} from '../../features/dataset-review';
export function ChangeHistoryPage({ review }: { review: DatasetReviewController }) {
  const { loadHistory } = review;
  const hasDataset = !!review.result;
  const [group, setGroup] = useState<{ key: string; description: string } | null>(null);
  useEffect(() => {
    if (hasDataset) {
      loadHistory();
    }
  }, [hasDataset, loadHistory]);
  return (
    <div className="app">
      <header>
        <div>
          <Typography.Title level={3}>Change history</Typography.Title>
          <Typography.Text type="secondary">
            {review.fileName || 'No dataset loaded'}
          </Typography.Text>
        </div>
        <Typography.Link href="#/">Back to dataset</Typography.Link>
      </header>
      <main>
        {review.historyError && <Alert type="error" showIcon message={review.historyError} />}
        {!hasDataset ? (
          <Empty description="Upload a CSV on the dataset page to view its changes." />
        ) : (
          <>
            <Typography.Paragraph>
              Identical changes across multiple rows appear first as change — [IDs]. Other entries
              show ID — change. Import formatting, manual edits and removed rows are included. IDs
              refer to the original record; missing IDs use the CSV record number.
            </Typography.Paragraph>
            {review.history ? (
              <>
                <Typography.Text>
                  {review.history.changes.toLocaleString()} changes ·{' '}
                  {review.history.groups.toLocaleString()} groups
                </Typography.Text>
                <ChangeHistoryTable
                  history={review.history}
                  busy={review.historyBusy}
                  onPageChange={loadHistory}
                  onShowIds={(key, description) => {
                    setGroup({ key, description });
                    review.loadHistoryIds(key);
                  }}
                />
              </>
            ) : (
              <Spin spinning={review.historyBusy}>
                <div style={{ minHeight: 100 }} />
              </Spin>
            )}
          </>
        )}
        <ChangeGroupIds
          group={group}
          data={review.historyIds}
          busy={review.idsBusy}
          error={review.historyError}
          onClose={() => setGroup(null)}
          onPageChange={(page) => {
            if (group) {
              review.loadHistoryIds(group.key, page);
            }
          }}
        />
      </main>
    </div>
  );
}

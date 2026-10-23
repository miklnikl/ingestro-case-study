import { Alert, Button, Collapse, Drawer, Empty, Spin, Typography } from 'antd';
import type { DatasetReviewController } from '../model/useDatasetReview';
import { IssueGroupPanel } from './IssueGroupPanel';
type Props = Pick<
  DatasetReviewController,
  | 'result'
  | 'busy'
  | 'error'
  | 'bulkDelete'
  | 'correctInvalidDates'
  | 'correctNegativeSpend'
  | 'deduplicateEmails'
  | 'generateTemporaryEmails'
  | 'issueValues'
  | 'issueValuesBusy'
  | 'issueValuesError'
  | 'loadIssueValues'
  | 'replaceIssueValue'
> & { open: boolean; onClose: () => void };
export function IssueAssistant({
  open,
  onClose,
  result,
  busy,
  error,
  bulkDelete,
  correctInvalidDates,
  correctNegativeSpend,
  deduplicateEmails,
  generateTemporaryEmails,
  issueValues,
  issueValuesBusy,
  issueValuesError,
  loadIssueValues,
  replaceIssueValue,
}: Props) {
  const groups = result?.issueGroups ?? [];
  return (
    <Drawer
      title="Issue assistant"
      placement="right"
      open={open}
      onClose={onClose}
      width={560}
      styles={{ wrapper: { maxWidth: '100vw' } }}
    >
      <Typography.Paragraph>
        Review errors by field. Actions apply to all matching errors in the dataset, including rows
        hidden by search or filters.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {groups.length ? (
        <Spin spinning={busy} tip="Applying changes…">
          <Collapse
            items={groups.map((group) => ({
              key: group.field,
              label: `${group.field.replaceAll('_', ' ')}: ${group.count.toLocaleString()}`,
              children: (
                <IssueGroupPanel
                  group={group}
                  busy={busy}
                  onDelete={bulkDelete}
                  onCorrectDates={correctInvalidDates}
                  onCorrectSpend={correctNegativeSpend}
                  onDeduplicate={deduplicateEmails}
                  onGenerateTemporary={generateTemporaryEmails}
                  emailDuplicates={result!.emailDuplicates}
                  valueOptions={issueValues?.field === group.field ? issueValues : null}
                  loadingValues={issueValuesBusy}
                  valuesError={issueValuesError}
                  onLoadValues={(search, limit) => loadIssueValues(group.field, search, limit)}
                  onReplaceValue={(source, value, count) =>
                    replaceIssueValue(group.field, source, value, count)
                  }
                />
              ),
            }))}
          />
        </Spin>
      ) : (
        <Empty description="No issues need your attention.">
          <Button onClick={onClose}>Back to dataset</Button>
        </Empty>
      )}
    </Drawer>
  );
}

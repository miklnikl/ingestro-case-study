import { NegativeSpendActions } from './NegativeSpendActions';
import { NearestDateActions } from './NearestDateActions';
import { TemporaryEmailAction } from './TemporaryEmailAction';
import { IssueValueReplacementForm } from './IssueValueReplacementForm';
import type { IssueValuePage } from '../model/issueValues';
import type { EmailDuplicateSummary } from '../model/emailDeduplication';
import { EmailDeduplicationOptions } from './EmailDeduplicationOptions';
import { Alert, Button, Popconfirm, Space, Typography } from 'antd';
import type { IssueGroup } from '../model/issueResolution';
import type { DatasetReviewController } from '../model/useDatasetReview';
type Props = {
  group: IssueGroup;
  busy: boolean;
  onDelete: DatasetReviewController['bulkDelete'];
  onCorrectDates: DatasetReviewController['correctInvalidDates'];
  onCorrectSpend: DatasetReviewController['correctNegativeSpend'];
  onDeduplicate: DatasetReviewController['deduplicateEmails'];
  onGenerateTemporary: DatasetReviewController['generateTemporaryEmails'];
  emailDuplicates: EmailDuplicateSummary;
  valueOptions: IssueValuePage | null;
  loadingValues: boolean;
  valuesError: string;
  onLoadValues: (search: string, limit: number) => void;
  onReplaceValue: (source: string, value: string, count: number) => void;
};
export function IssueGroupPanel({
  group,
  busy,
  onDelete,
  onCorrectDates,
  onCorrectSpend,
  onDeduplicate,
  onGenerateTemporary,
  emailDuplicates,
  valueOptions,
  loadingValues,
  valuesError,
  onLoadValues,
  onReplaceValue,
}: Props) {
  const label = group.field.replaceAll('_', ' ');
  const invalidEmailsOnly = group.field === 'email' && emailDuplicates.removable === 0;
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {invalidEmailsOnly ? (
        <Alert
          type="warning"
          showIcon
          message="The remaining emails are invalid, not duplicates."
          description="Remove these records, replace a specific invalid value below, or correct individual cells in the table."
        />
      ) : group.field === 'email' || group.field === 'customer_id' ? (
        <Typography.Paragraph>
          Email and customer IDs must remain unique. Replacing the entire category with one value is
          unavailable. You can replace a specific invalid value below when uniqueness is preserved,
          edit individual cells, or remove records.
        </Typography.Paragraph>
      ) : null}
      {group.field === 'email' && emailDuplicates.removable > 0 && (
        <EmailDeduplicationOptions
          summary={emailDuplicates}
          busy={busy}
          onDeduplicate={onDeduplicate}
        />
      )}
      {group.field === 'email' && group.empty > 0 && (
        <TemporaryEmailAction count={group.empty} busy={busy} onGenerate={onGenerateTemporary} />
      )}
      {group.field === 'email' && !!group.invalidEmailCount && (
        <TemporaryEmailAction
          count={group.invalidEmailCount}
          busy={busy}
          onGenerate={onGenerateTemporary}
          scope="invalid"
        />
      )}
      {group.field === 'signup_date' && group.dateCorrections && (
        <NearestDateActions
          preview={group.dateCorrections}
          busy={busy}
          onCorrect={onCorrectDates}
        />
      )}
      {group.field === 'monthly_spend' && group.negativeSpend && (
        <NegativeSpendActions
          preview={group.negativeSpend}
          busy={busy}
          onCorrect={onCorrectSpend}
        />
      )}
      <IssueValueReplacementForm
        field={group.field}
        busy={busy}
        options={valueOptions}
        loading={loadingValues}
        error={valuesError}
        onLoad={onLoadValues}
        onReplace={onReplaceValue}
      />
      <Popconfirm
        title={
          invalidEmailsOnly
            ? `Remove all ${group.count.toLocaleString()} records with invalid emails?`
            : `Remove all ${group.count.toLocaleString()} records with ${label} issues?`
        }
        description="This removes entire records, including their values in other columns. Use Undo last change to restore these records before making another change."
        okText="Remove records"
        okButtonProps={{ danger: true }}
        onConfirm={() => onDelete(group.field, group.count)}
        disabled={busy}
      >
        <Button danger disabled={busy}>
          {invalidEmailsOnly
            ? `Remove all ${group.count.toLocaleString()} records with invalid emails`
            : `Remove all ${group.count.toLocaleString()} records in this group`}
        </Button>
      </Popconfirm>
    </Space>
  );
}

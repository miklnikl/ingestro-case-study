import type { TemporaryEmailScope } from '../model/temporaryEmails';
import { Button, Popconfirm, Typography } from 'antd';
export function TemporaryEmailAction({
  count,
  busy,
  onGenerate,
  scope = 'empty',
}: {
  count: number;
  busy: boolean;
  onGenerate: (count: number, scope: TemporaryEmailScope) => void;
  scope?: TemporaryEmailScope;
}) {
  return (
    <section className="issue-replacement">
      <Typography.Text type="secondary">
        Generate a unique placeholder for each {scope === 'empty' ? 'empty' : 'invalid or empty'}{' '}
        email, such as temporary-123@example.invalid. These are not real inboxes.
      </Typography.Text>
      <Popconfirm
        title={`Generate temporary emails for ${count.toLocaleString()} ${scope === 'empty' ? 'empty values' : 'invalid or empty emails'}?`}
        description={
          scope === 'empty'
            ? 'Only empty email cells will change. Each gets a unique placeholder address, and the changes are recorded in history.'
            : 'All malformed and empty emails will get unique placeholder addresses. Correctly formatted emails, including duplicates, stay unchanged. Changes are recorded in history.'
        }
        okText="Generate emails"
        disabled={busy}
        onConfirm={() => onGenerate(count, scope)}
      >
        <Button disabled={busy}>
          {scope === 'invalid'
            ? 'Generate temporary emails for all invalid emails'
            : `Generate temporary emails for empty values (${count.toLocaleString()})`}
        </Button>
      </Popconfirm>
    </section>
  );
}

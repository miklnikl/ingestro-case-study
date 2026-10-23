import { RecordLink } from './RecordLink';
import { Button, Popconfirm, Space, Typography } from 'antd';
import type { NegativeSpendMode, NegativeSpendPreview } from '../model/negativeSpend';
type Props = {
  preview: NegativeSpendPreview;
  busy: boolean;
  onCorrect: (mode: NegativeSpendMode, count: number) => void;
};
export function NegativeSpendActions({ preview, busy, onCorrect }: Props) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Typography.Paragraph>
        Convert all negative numeric amounts to positive values or zero. Empty values and
        unrecognized formats are skipped. Non-negative amounts stay unchanged.
      </Typography.Paragraph>
      {(['positive', 'zero'] as const).map((mode) => (
        <Popconfirm
          key={mode}
          title={`Convert ${preview.count.toLocaleString()} negative amounts to ${mode === 'positive' ? 'positive values' : '0'}?`}
          description={
            <div>
              Examples:
              <ul className="issue-samples">
                {preview.samples.map((sample, index) => (
                  <li key={index}>
                    <RecordLink id={sample.customerId} />: {sample.before} →{' '}
                    {mode === 'positive' ? sample.positive : '0'}
                  </li>
                ))}
              </ul>
              All matching negative amounts across the dataset will change. Changes are recorded in
              history.
            </div>
          }
          okText="Convert amounts"
          disabled={busy || !preview.count}
          onConfirm={() => onCorrect(mode, preview.count)}
        >
          <Button disabled={busy || !preview.count}>
            {mode === 'positive' ? 'Convert negative to positive' : 'Convert negative to 0'} (
            {preview.count.toLocaleString()})
          </Button>
        </Popconfirm>
      ))}
    </Space>
  );
}

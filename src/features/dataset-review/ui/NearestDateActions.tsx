import { RecordLink } from './RecordLink';
import { Button, Popconfirm, Space, Typography } from 'antd';
import type { DateCorrectionPreview, DateDirection } from '../model/dateCorrection';
type Props = {
  preview: DateCorrectionPreview;
  busy: boolean;
  onCorrect: (direction: DateDirection, count: number) => void;
};
export function NearestDateActions({ preview, busy, onCorrect }: Props) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Typography.Paragraph>
        Convert impossible calendar days in YYYY-MM-DD dates to the nearest valid day before or
        after the supplied day. Empty dates, unrecognized formats and invalid months are skipped.
        Valid dates stay unchanged.
      </Typography.Paragraph>
      {(['earlier', 'later'] as const).map((direction) => (
        <Popconfirm
          key={direction}
          title={`Convert ${preview[direction].count.toLocaleString()} dates to the nearest ${direction} valid date?`}
          description={
            <div>
              Examples:
              <ul className="issue-samples">
                {preview[direction].samples.map((sample, index) => (
                  <li key={index}>
                    <RecordLink id={sample.customerId} />: {sample.before} → {sample.after}
                  </li>
                ))}
              </ul>
              All correctable invalid dates across the dataset will change. Changes are recorded in
              history.
            </div>
          }
          okText="Convert dates"
          disabled={busy || !preview[direction].count}
          onConfirm={() => onCorrect(direction, preview[direction].count)}
        >
          <Button disabled={busy || !preview[direction].count}>
            Convert to nearest {direction} valid date ({preview[direction].count.toLocaleString()})
          </Button>
        </Popconfirm>
      ))}
    </Space>
  );
}

import { Typography } from 'antd';
import { SummaryStat } from '../../../shared/ui/SummaryStat';
import type { Result } from '../model/protocol';
export function DatasetSummary({
  total,
  invalid,
  corrected,
}: Pick<Result, 'total' | 'invalid' | 'corrected'>) {
  return (
    <section className="summary" aria-live="polite">
      <SummaryStat value={total} label="Total rows" />
      <SummaryStat value={invalid} label="Rows needing attention" />
      <SummaryStat value={corrected} label="Rows formatted on import" />
      <Typography.Link href="#/changes">View change history</Typography.Link>
    </section>
  );
}

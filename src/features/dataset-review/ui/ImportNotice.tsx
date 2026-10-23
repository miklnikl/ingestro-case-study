import { Alert } from 'antd';
export function ImportNotice({ onClose }: { onClose: () => void }) {
  return (
    <Alert
      type="info"
      showIcon
      closable
      onClose={onClose}
      message="Safe formatting fixes are applied during import."
      description="Whitespace is trimmed; known country names, plan casing, dates and monetary formats are normalized. Slash dates use DD/MM/YYYY. Missing values, impossible dates, typos and duplicates require your review."
    />
  );
}

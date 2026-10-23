import { useEffect } from 'react';
import { Popover } from 'antd';
import type { EditPropagationSuggestion } from '../model/editPropagation';
import type { CellEditAnchor } from './DatasetEditableCell';
import { EditPropagationPrompt } from './EditPropagationPrompt';
type Props = {
  anchor: CellEditAnchor | null;
  suggestion: EditPropagationSuggestion | null;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
};
export function EditPropagationPopover({ anchor, suggestion, busy, onApply, onDismiss }: Props) {
  const open =
    !!anchor &&
    !!suggestion &&
    anchor.rowKey === suggestion.rowKey &&
    anchor.field === suggestion.field;
  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = () => onDismiss();
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('popstate', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('popstate', dismiss);
    };
  }, [open, onDismiss]);
  if (!open || !anchor || !suggestion) {
    return null;
  }
  return (
    <Popover
      open
      placement="right"
      trigger="click"
      onOpenChange={(next) => {
        if (!next) {
          onDismiss();
        }
      }}
      content={
        <EditPropagationPrompt
          suggestion={suggestion}
          busy={busy}
          onApply={onApply}
          onDismiss={onDismiss}
        />
      }
    >
      <span
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: anchor.rect.left,
          top: anchor.rect.top,
          width: anchor.rect.width,
          height: anchor.rect.height,
          pointerEvents: 'none',
        }}
      />
    </Popover>
  );
}

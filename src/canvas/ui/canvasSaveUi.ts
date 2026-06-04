import type { TLUiOverrideHelpers } from 'tldraw';
import type { ManualSaveResult } from '../../hooks/useCanvasSync';

export function toastForManualSave(
  result: ManualSaveResult,
  helpers: TLUiOverrideHelpers
) {
  if (result.ok) {
    helpers.addToast({
      id: 'canvas-manual-save',
      severity: 'success',
      title:
        result.status === 'already_synced' ? 'Já estava salvo' : 'Canvas salvo',
      description: result.message,
    });
    return;
  }

  helpers.addToast({
    id: 'canvas-manual-save-error',
    severity: result.status === 'session_expired' ? 'warning' : 'error',
    title: 'Não foi possível salvar',
    description: result.message ?? 'Tente novamente.',
  });
}

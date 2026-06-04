import type { Editor } from 'tldraw';

/** Texto em edição com trecho selecionado (não apenas cursor). */
export function isEditingRichTextWithSelection(editor: Editor): boolean {
  const textEditor = editor.getRichTextEditor();
  if (!textEditor?.view) return false;

  const editingId = editor.getEditingShapeId();
  if (!editingId) return false;

  const shape = editor.getShape(editingId);
  if (!shape || !('richText' in shape.props)) return false;

  return !textEditor.state.selection.empty;
}

import {
  DefaultColorStyle,
  Editor,
  getColorValue,
  StyleProp,
  StylePropValue,
  TLDefaultColorStyle,
} from 'tldraw';

function isEditingRichText(editor: Editor): boolean {
  const textEditor = editor.getRichTextEditor();
  if (!textEditor?.view) return false;

  const editingId = editor.getEditingShapeId();
  if (!editingId) return false;

  const shape = editor.getShape(editingId);
  if (!shape || !('richText' in shape.props)) return false;

  return !textEditor.state.selection.empty;
}

function applyColorToTextSelection(
  editor: Editor,
  colorName: TLDefaultColorStyle
): boolean {
  const textEditor = editor.getRichTextEditor();
  if (!textEditor?.view || !isEditingRichText(editor)) return false;

  const colorMode = editor.getColorMode();
  const hex = getColorValue(
    editor.getCurrentTheme().colors[colorMode],
    colorName,
    'solid'
  );

  textEditor.chain().focus().setTextColor(hex).run();
  return true;
}

/**
 * Ao editar texto com trecho selecionado, o painel de cor aplica a marca `textColor`
 * em vez de mudar `props.color` da shape inteira.
 */
export function installRichTextColorHandler(editor: Editor): () => void {
  const original = editor.setStyleForSelectedShapes.bind(editor);

  editor.setStyleForSelectedShapes = function <S extends StyleProp<unknown>>(
    style: S,
    value: StylePropValue<S>
  ) {
    if (
      style.id === DefaultColorStyle.id &&
      applyColorToTextSelection(editor, value as TLDefaultColorStyle)
    ) {
      return editor;
    }
    return original(style, value);
  };

  return () => {
    editor.setStyleForSelectedShapes = original;
  };
}

import { DefaultFontStyle } from '@tldraw/tlschema';
import {
  DefaultColorStyle,
  Editor,
  getColorValue,
  getFontFamily,
  StyleProp,
  StylePropValue,
  TLDefaultColorStyle,
  TLDefaultFontStyle,
} from 'tldraw';
import { isEditingRichTextWithSelection } from './richTextSelection';

function applyColorToTextSelection(
  editor: Editor,
  colorName: TLDefaultColorStyle
): boolean {
  const textEditor = editor.getRichTextEditor();
  if (!textEditor?.view || !isEditingRichTextWithSelection(editor)) return false;

  const colorMode = editor.getColorMode();
  const hex = getColorValue(
    editor.getCurrentTheme().colors[colorMode],
    colorName,
    'solid'
  );

  textEditor.chain().focus().setTextColor(hex).run();
  return true;
}

function applyFontToTextSelection(
  editor: Editor,
  fontKey: TLDefaultFontStyle
): boolean {
  const textEditor = editor.getRichTextEditor();
  if (!textEditor?.view || !isEditingRichTextWithSelection(editor)) return false;

  const fontFamily = getFontFamily(editor.getCurrentTheme(), fontKey);
  textEditor.chain().focus().setTextFont({ fontKey, fontFamily }).run();
  return true;
}

/**
 * Com trecho de texto selecionado em edição, cor e fonte do painel aplicam marcas
 * TipTap no trecho em vez de alterar props da shape inteira.
 */
export function installRichTextStyleHandler(editor: Editor): () => void {
  const original = editor.setStyleForSelectedShapes.bind(editor);

  editor.setStyleForSelectedShapes = function <S extends StyleProp<unknown>>(
    style: S,
    value: StylePropValue<S>
  ) {
    if (style.id === DefaultColorStyle.id) {
      if (applyColorToTextSelection(editor, value as TLDefaultColorStyle)) {
        return editor;
      }
    }

    if (style.id === DefaultFontStyle.id) {
      if (applyFontToTextSelection(editor, value as TLDefaultFontStyle)) {
        return editor;
      }
    }

    return original(style, value);
  };

  return () => {
    editor.setStyleForSelectedShapes = original;
  };
}

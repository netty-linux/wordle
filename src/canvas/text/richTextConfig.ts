import type { TiptapNode, RichTextFontVisitorState, TLFontFace } from '@tldraw/editor';
import { defaultAddFontsFromNode, tipTapDefaultExtensions } from 'tldraw';
import { TextColorExtension } from './textColorExtension';
import { TextFontExtension } from './textFontExtension';

const FONT_KEY_TO_TLDRAW_FAMILY: Record<string, string> = {
  draw: 'tldraw_draw',
  sans: 'tldraw_sans',
  serif: 'tldraw_serif',
  mono: 'tldraw_mono',
};

/** Inclui fontes de trechos com marca `textFont` na exportação SVG/PNG. */
export function canvasAddFontsFromNode(
  node: TiptapNode,
  state: RichTextFontVisitorState,
  addFont: (font: TLFontFace) => void
) {
  for (const mark of node.marks) {
    if (mark.type.name === 'textFont' && mark.attrs.fontKey) {
      const mapped = FONT_KEY_TO_TLDRAW_FAMILY[String(mark.attrs.fontKey)];
      if (mapped) {
        state = { ...state, family: mapped };
      }
    }
  }
  return defaultAddFontsFromNode(node, state, addFont);
}

/** Extensões TipTap do canvas (padrão tldraw + cor e fonte por seleção). */
export const canvasTipTapExtensions = [
  ...tipTapDefaultExtensions,
  TextColorExtension,
  TextFontExtension,
];

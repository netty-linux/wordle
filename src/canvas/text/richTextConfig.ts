import { tipTapDefaultExtensions } from 'tldraw';
import { TextColorExtension } from './textColorExtension';

/** Extensões TipTap do canvas (padrão tldraw + cor por seleção). */
export const canvasTipTapExtensions = [
  ...tipTapDefaultExtensions,
  TextColorExtension,
];

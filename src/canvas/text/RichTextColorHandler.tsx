'use client';

import { useEditor } from 'tldraw';
import { useEffect } from 'react';
import { installRichTextColorHandler } from './installRichTextColorHandler';

/** Registra o handler de cor por seleção no editor ativo. */
export function RichTextColorHandler() {
  const editor = useEditor();

  useEffect(() => {
    return installRichTextColorHandler(editor);
  }, [editor]);

  return null;
}

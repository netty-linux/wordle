'use client';

import { useEditor } from 'tldraw';
import { useEffect } from 'react';
import { installRichTextStyleHandler } from './installRichTextStyleHandler';

/** Registra cor e fonte por seleção no editor ativo. */
export function RichTextStyleHandler() {
  const editor = useEditor();

  useEffect(() => {
    return installRichTextStyleHandler(editor);
  }, [editor]);

  return null;
}

'use client';

import {
  DefaultMainMenu,
  DefaultMainMenuContent,
  TldrawUiMenuActionItem,
  TldrawUiMenuGroup,
} from 'tldraw';

/** Menu principal com atalho de salvar canvas. */
export function CanvasMainMenu() {
  return (
    <DefaultMainMenu>
      <>
        <TldrawUiMenuGroup id="canvas-file">
          <TldrawUiMenuActionItem actionId="save-canvas" />
        </TldrawUiMenuGroup>
        <DefaultMainMenuContent />
      </>
    </DefaultMainMenu>
  );
}

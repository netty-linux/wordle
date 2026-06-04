'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  needsTldrawLicenseKey,
  TLDRAW_LICENSE_KEY,
} from '../lib/tldraw-license';
import {
  Tldraw,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  useTools,
  useIsToolSelected,
  TLUiOverrides,
  TLComponents
} from 'tldraw';
import { useCanvasSync } from '../hooks/useCanvasSync';
import { useYjsStore } from '../hooks/useYjsStore';
import { TaskCardShapeUtil } from '../canvas/shapes/TaskCardShape';
import { TaskCardTool } from '../canvas/tools/TaskCardTool';
import { AcademicSidebar } from '../canvas/ui/AcademicSidebar';
import {
  canvasAddFontsFromNode,
  canvasTipTapExtensions,
} from '../canvas/text/richTextConfig';
import { RichTextStyleHandler } from '../canvas/text/RichTextStyleHandler';

import 'tldraw/tldraw.css';

// Configurações estáveis fora do ciclo de render para evitar loops e re-inicializações
const customShapeUtils = [TaskCardShapeUtil];
const customTools = [TaskCardTool];

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools['task-card'] = {
      id: 'task-card',
      icon: 'note', // Ícone padrão de nota adesiva
      label: 'Task Card',
      kbd: 'c',
      onSelect() {
        editor.setCurrentTool('task-card');
      },
    };
    return tools;
  },
};

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isSelected = useIsToolSelected(tools['task-card']);
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools['task-card']} isSelected={isSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
  InFrontOfTheCanvas: AcademicSidebar,
};

interface CanvasProps {
  id: string;
}

/**
 * Componente Principal do Canvas Colaborativo.
 * Renderiza o Tldraw ocupando 100% da tela e sincroniza o estado via Yjs e SQLite.
 */
function TldrawLicenseSetup() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-100 font-sans">
      <div className="max-w-lg rounded-lg border border-amber-500/30 bg-amber-950/20 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-amber-300">
          Licença do tldraw necessária
        </h2>
        <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
          O SDK do tldraw exige uma chave de licença em deploys de produção (como
          na Vercel). Sem ela, o editor não renderiza — por isso a tela fica preta.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>
            Obtenha uma licença gratuita em{' '}
            <a
              href="https://tldraw.dev/get-a-license/trial"
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 underline"
            >
              trial (100 dias)
            </a>{' '}
            ou{' '}
            <a
              href="https://tldraw.dev/get-a-license/hobby"
              target="_blank"
              rel="noreferrer"
              className="text-violet-400 underline"
            >
              hobby (projetos não comerciais)
            </a>
            .
          </li>
          <li>
            Adicione no <strong className="text-zinc-200">.env.local</strong> e na
            Vercel (Settings → Environment Variables):
            <pre className="mt-2 overflow-x-auto rounded border border-zinc-800 bg-zinc-900/80 p-3 text-xs font-mono text-emerald-300">
              NEXT_PUBLIC_TLDRAW_LICENSE_KEY=tldraw-...
            </pre>
          </li>
          <li>Faça um novo deploy na Vercel.</li>
        </ol>
      </div>
    </div>
  );
}

const canvasTextOptions = {
  addFontsFromNode: canvasAddFontsFromNode,
  tipTapConfig: {
    extensions: canvasTipTapExtensions,
  },
};

function CanvasEditor({ id }: CanvasProps) {
  const [isTldrawHydrated, setIsTldrawHydrated] = useState(false);
  const textOptions = useMemo(() => canvasTextOptions, []);

  // 1. Yjs + API sync (POST pauses until tldraw finishes hydrating from Y.Doc)
  const { ydoc, isDocLoaded, isSaving, error, sessionExpired } = useCanvasSync({
    id,
    isSyncReady: isTldrawHydrated,
  });

  // 2. Tldraw store ↔ Y.Doc
  const storeWithStatus = useYjsStore({ ydoc, isDocLoaded });

  useEffect(() => {
    setIsTldrawHydrated(storeWithStatus.status === 'synced-remote');
  }, [storeWithStatus.status]);

  // Tela de Erro com painel técnico formatado em 'Departure Mono'
  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 p-6 text-zinc-100 font-sans" suppressHydrationWarning>
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-950/20 p-6 shadow-xl backdrop-blur-md" suppressHydrationWarning>
          <h2 className="text-xl font-semibold text-red-400 font-sans tracking-tight">
            Falha na Conexão
          </h2>
          <p className="mt-2 text-zinc-400 text-sm font-sans leading-relaxed">
            Ocorreu um erro ao carregar ou sincronizar o estado do seu canvas local.
          </p>
          <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/80 p-4 shadow-inner" suppressHydrationWarning>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 font-sans">
              Log de Erro / Console Debug
            </span>
            <pre className="mt-2 overflow-x-auto text-xs font-mono text-zinc-300 antialiased font-departure-mono">
              {error.message || String(error)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Tela de Carregamento estilizada em 'Geist'
  if (storeWithStatus.status === 'loading') {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 font-sans" suppressHydrationWarning>
        <div className="flex flex-col items-center gap-3" suppressHydrationWarning>
          <div className="relative flex h-10 w-10" suppressHydrationWarning>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex h-10 w-10 rounded-full bg-violet-500/80"></span>
          </div>
          <span className="mt-2 text-sm font-medium tracking-wide text-zinc-400 animate-pulse font-sans">
            Preparando canvas local-first...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-zinc-950 overflow-hidden font-sans select-none">
      {sessionExpired && (
        <div className="absolute top-4 left-1/2 z-[10000] w-[min(100%,28rem)] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/90 px-4 py-3 shadow-lg backdrop-blur-md">
          <p className="text-sm text-amber-100">
            Sessão expirada — seu desenho continua neste dispositivo, mas não está
            sendo salvo na nuvem.
          </p>
          <a
            href="/login?callbackUrl=/"
            className="mt-2 inline-block text-sm font-semibold text-amber-300 underline"
          >
            Fazer login novamente
          </a>
        </div>
      )}
      <Tldraw
        licenseKey={TLDRAW_LICENSE_KEY}
        store={storeWithStatus.store}
        shapeUtils={customShapeUtils}
        tools={customTools}
        overrides={uiOverrides}
        components={components}
        textOptions={textOptions}
      >
        <RichTextStyleHandler />
      </Tldraw>

      {/* Indicador sutil de salvamento em background (Lazy Sync) */}
      {isSaving && (
        <div className="absolute bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 font-departure-mono">
            Salvando...
          </span>
        </div>
      )}
    </div>
  );
}

export default function Canvas({ id }: CanvasProps) {
  const [licenseBlocked, setLicenseBlocked] = useState(false);

  useEffect(() => {
    setLicenseBlocked(needsTldrawLicenseKey());
  }, []);

  if (licenseBlocked) {
    return <TldrawLicenseSetup />;
  }

  return <CanvasEditor id={id} />;
}

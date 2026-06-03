'use client';

import React from 'react';
import { useEditor, useValue } from 'tldraw';
import { MousePointer2, Pencil, ClipboardList, FlaskConical } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Componente nativo do Tldraw: AcademicSidebar.
 * Injetado no slot InFrontOfTheCanvas do Tldraw.
 * 
 * Utiliza o hook useEditor() para interagir diretamente com o estado do canvas
 * e a API nativa useValue() para reagir a mudanças no estado do editor (FSM).
 */
export function AcademicSidebar() {
  const editor = useEditor();
  const router = useRouter();

  // hook nativo do Tldraw para reatividade: escuta a FSM para saber qual ferramenta está ativa
  const currentToolId = useValue('current tool', () => editor.getCurrentToolId(), [editor]);

  // Função para modificar o estado da máquina de estados do editor
  const handleSelectTool = (toolId: string) => {
    // setCurrentTool transiciona o estado da máquina de estados (FSM) do editor
    editor.setCurrentTool(toolId);
  };

  const tools = [
    {
      id: 'select',
      label: 'Selecionar',
      Icon: MousePointer2,
    },
    {
      id: 'draw',
      label: 'Desenhar',
      Icon: Pencil,
    },
    {
      id: 'task-card',
      label: 'Task Card',
      Icon: ClipboardList,
    },
  ];

  return (
    // Div envolvente com pointer-events-none para não bloquear o desenho/cliques no canvas abaixo
    <div className="pointer-events-none absolute inset-0 z-[100] flex items-center">
      {/* Barra lateral com pointer-events-auto para permitir interação com os botões */}
      <aside className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-white/90 backdrop-blur border border-zinc-200 rounded-2xl p-2 shadow-lg">
        {tools.map((tool) => {
          const isActive = currentToolId === tool.id;
          const Icon = tool.Icon;
          return (
            <button
              key={tool.id}
              onClick={() => handleSelectTool(tool.id)}
              title={tool.label}
              className={`p-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 border border-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}

        {/* Linha divisória sutil para ação global */}
        <hr className="border-zinc-200 my-1 w-full" />

        {/* Botão para acessar o Laboratório Interativo (Playgrounds) */}
        <button
          onClick={() => router.push('/playgrounds')}
          title="Laboratório Interativo"
          className="p-3 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 border border-transparent transition-all duration-200"
        >
          <FlaskConical className="w-5 h-5" />
        </button>
      </aside>
    </div>
  );
}


'use client';

import React from 'react';
import { HTMLContainer, Rectangle2d, ShapeUtil, TLShape } from 'tldraw';

// 1. Tipagem das Propriedades da Shape
export type TaskCardShapeProps = {
  w: number;
  h: number;
  title: string;
  content: string;
  status: 'todo' | 'in_progress' | 'done';
  color: string;
};

// 2. Registro de propriedades via Module Augmentation
declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'task-card': TaskCardShapeProps;
  }
}

// Interface da Shape Customizada
export type ITaskCardShape = TLShape<'task-card'>;

// Preset de cores inspiradas no Linear/Vercel
const PRESET_COLORS = [
  '#8b5cf6', // Violeta
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Laranja
  '#ef4444', // Vermelho
];

/**
 * Utilitário de Shape Customizada (TaskCardShapeUtil).
 * Define as propriedades padrão, a geometria para detecção de cliques e renderiza a UI interativa.
 */
export class TaskCardShapeUtil extends ShapeUtil<ITaskCardShape> {
  static override type = 'task-card' as const;

  // Valores padrão para novas instâncias
  override getDefaultProps(): TaskCardShapeProps {
    return {
      w: 280,
      h: 180,
      title: 'Nova Tarefa',
      content: 'Clique para editar a descrição...',
      status: 'todo',
      color: '#8b5cf6',
    };
  }

  // Geometria usada para colisão, seleção e redimensionamento no canvas
  override getGeometry(shape: ITaskCardShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  // Outline/Indicador geométrico de seleção
  override getIndicatorPath(shape: ITaskCardShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  // Renderiza a borda de seleção/hover no canvas do Tldraw
  override indicator(shape: ITaskCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={12} ry={12} />;
  }

  // Renderização da UI do Card utilizando HTML dentro da viewport do canvas
  override component(shape: ITaskCardShape) {
    const { title, content, status, color, w, h } = shape.props;

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: 'all',
        }}
      >
        <div className="relative w-full h-full flex flex-col rounded-xl bg-zinc-950/95 border border-zinc-800/80 shadow-2xl overflow-hidden font-sans text-zinc-200 antialiased">
          
          {/* Faixa de cor lateral que indica o accent selecionado */}
          <div
            className="absolute top-0 left-0 bottom-0 w-1.5 transition-colors duration-200"
            style={{ backgroundColor: color }}
          />

          {/* Conteúdo Interno */}
          <div className="pl-4.5 pr-4.5 pt-3.5 pb-3 flex-1 flex flex-col justify-between ml-1.5">
            
            {/* Header: Status do Kanban e ID da Tarefa */}
            <div className="flex items-center justify-between">
              
              {/* Dropdown de status com ponto colorido pulsante se estiver em andamento/done */}
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  status === 'done' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' :
                  status === 'in_progress' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]' : 
                  'bg-zinc-400'
                }`} />
                <select
                  value={status}
                  onChange={(e) => {
                    this.editor.updateShape<ITaskCardShape>({
                      id: shape.id,
                      type: 'task-card',
                      props: { status: e.target.value as any },
                    });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="bg-transparent border-none text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase focus:outline-none cursor-pointer p-0"
                >
                  <option value="todo" className="bg-zinc-900 text-zinc-300">Todo</option>
                  <option value="in_progress" className="bg-zinc-900 text-zinc-300">In Progress</option>
                  <option value="done" className="bg-zinc-900 text-zinc-300">Done</option>
                </select>
              </div>

              {/* Tag técnica no canvas em 'Departure Mono' */}
              <span className="text-[10px] font-mono font-semibold text-zinc-600 tracking-wider font-departure-mono select-none">
                TASK-{shape.id.replace('shape:', '').slice(0, 4).toUpperCase()}
              </span>
            </div>

            {/* Inputs de Conteúdo */}
            <div className="mt-2 flex-1 flex flex-col">
              {/* Input do Título (Geist) */}
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  this.editor.updateShape<ITaskCardShape>({
                    id: shape.id,
                    type: 'task-card',
                    props: { title: e.target.value },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="bg-transparent text-zinc-100 font-bold text-sm border-none focus:outline-none focus:ring-1 focus:ring-zinc-800 rounded px-1 -mx-1 w-full"
                placeholder="Título do card..."
              />

              {/* Textarea do Conteúdo (Geist) */}
              <textarea
                value={content}
                onChange={(e) => {
                  this.editor.updateShape<ITaskCardShape>({
                    id: shape.id,
                    type: 'task-card',
                    props: { content: e.target.value },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="bg-transparent text-zinc-400 text-xs mt-1.5 border-none focus:outline-none focus:ring-1 focus:ring-zinc-800 rounded p-1 -m-1 resize-none h-16 w-full leading-relaxed overflow-hidden"
                placeholder="Adicione descrição ou notas..."
              />
            </div>

            {/* Footer: Seletor de cores da borda acentuada */}
            <div className="flex items-center justify-between border-t border-zinc-900 pt-2.5 mt-2">
              <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest font-sans select-none">
                Accent
              </span>
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      this.editor.updateShape<ITaskCardShape>({
                        id: shape.id,
                        type: 'task-card',
                        props: { color: c },
                      });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ backgroundColor: c }}
                    className={`h-2.5 w-2.5 rounded-full border transition-all duration-200 hover:scale-125 ${
                      color === c ? 'border-zinc-300 scale-110 shadow-lg' : 'border-transparent'
                    }`}
                    title={c}
                  />
                ))}
              </div>
            </div>

          </div>

        </div>
      </HTMLContainer>
    );
  }
}

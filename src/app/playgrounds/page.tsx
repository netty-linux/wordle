'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft, RotateCcw } from 'lucide-react';
import { PlaygroundForm } from './PlaygroundForm';
import { WidgetEngine } from '../../components/widgets/WidgetEngine';
import ReactMarkdown from 'react-markdown';

export default function PlaygroundsPage() {
  const [labData, setLabData] = useState<any>(null);

  return (
    <div className="min-h-screen w-full bg-[#faf9f6] text-black flex flex-col items-center justify-between p-6 select-none relative font-sans">
      
      {/* Botão de Voltar para o Canvas no topo esquerdo */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-white rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all font-sans text-xs font-bold uppercase tracking-wider text-black"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Canvas
        </Link>
      </div>

      <div className={`flex-1 flex flex-col items-center justify-center gap-8 w-full py-12 transition-all ${
        labData ? 'max-w-[90rem]' : 'max-w-xl'
      }`}>
        {!labData ? (
          <>
            {/* Ícone Central: Container quadrado branco com borda preta grossa e sombra sólida */}
            <div className="w-20 h-20 bg-white border-[3px] border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-10 h-10 text-amber-500 fill-amber-500/20" />
            </div>

            {/* Títulos */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight font-sans text-black">
                Laboratório Interativo
              </h1>
              <p className="text-sm text-zinc-600 font-sans max-w-md mx-auto leading-relaxed">
                Bem-vindo ao espaço de experimentos acadêmicos. Digite o tema que deseja estudar e nós geramos o seu laboratório interativo.
              </p>
            </div>

            {/* Formulário de Pesquisa */}
            <PlaygroundForm onLabGenerated={setLabData} />
          </>
        ) : (
          <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="text-center space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                LABORATÓRIO GERADO
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight font-sans text-black leading-tight">
                {labData.title}
              </h1>
            </div>

            {/* Grid Lado a Lado (Side-by-Side) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start w-full max-w-[90rem] mx-auto mt-8">
              {/* Coluna da Esquerda (Teoria) */}
              <div className="w-full bg-white border-4 border-black p-6 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3">
                <h2 className="text-base font-bold uppercase tracking-wide text-zinc-800 border-b-2 border-zinc-200 pb-2">
                  Conceito & Instruções
                </h2>
                <div className="text-black font-sans leading-relaxed">
                  <ReactMarkdown
                    components={{
                      strong: ({ node, ...props }) => (
                        <strong className="font-bold bg-yellow-300 px-1 border-b-2 border-black rounded-sm text-black" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 leading-relaxed text-lg text-zinc-700" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xl font-bold mt-6 mb-2 text-black" {...props} />
                      ),
                    }}
                  >
                    {labData.explanationText}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Coluna da Direita (Widget Dinâmico com rolagem fixa) */}
              <div className="sticky top-8">
                <WidgetEngine type={labData.widgetType} config={labData.widgetConfig} />
              </div>
            </div>

            {/* Controles (Botão de Voltar ao Topo) */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setLabData(null)}
                className="flex items-center gap-2 px-6 py-3 border-3 border-black bg-white rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-sans text-xs font-bold uppercase tracking-wider text-black cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Criar Novo Laboratório
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé sutil */}
      <footer className="text-center py-4">
        <span className="text-[10px] text-zinc-400 font-sans tracking-wide uppercase">
          Wired Wordle — Playgrounds
        </span>
      </footer>
    </div>
  );
}

// Force-recompile trigger


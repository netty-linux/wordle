'use client';

import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { generateLab } from '../actions/generateLab';

export function PlaygroundForm({ onLabGenerated }: { onLabGenerated: (data: any) => void }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setIsLoading(true);
      setErrorMsg(null);
      console.log('[PlaygroundForm] Iniciando geração de lab para:', query);

      const result = await generateLab(query);

      if (result.success && result.data) {
        console.log('[PlaygroundForm] Sucesso na API do Gemini. Resposta JSON:', result.data);
        onLabGenerated(result.data);
      } else {
        setErrorMsg(result.error || 'Falha ao processar requisição.');
      }
    } catch (err: any) {
      console.error('[PlaygroundForm] Erro na requisição:', err);
      setErrorMsg(err.message || 'Ocorreu um erro ao conectar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl flex flex-col gap-3 font-sans"
    >
      {/* Container do Input de Pesquisa: Borda grossa e sombra sólida */}
      <div className="flex items-center w-full bg-white border-[3px] border-black rounded-xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform focus-within:-translate-y-0.5 focus-within:translate-x-0.5 focus-within:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Ícone de Lupa */}
        <div className="pl-4 text-zinc-400">
          <Search className="w-5 h-5" />
        </div>

        {/* Input Text */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          placeholder="O que você deseja aprender ou experimentar hoje?"
          className="flex-1 px-3 py-4 text-sm text-black placeholder-zinc-400 bg-transparent focus:outline-none font-medium font-sans disabled:opacity-50"
        />

        {/* Botão GERAR LAB */}
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6 py-4 bg-zinc-800 hover:bg-zinc-900 disabled:bg-zinc-300 disabled:text-zinc-500 text-white text-xs font-bold uppercase tracking-wider border-l-2 border-black transition-colors duration-150 font-sans cursor-pointer h-full flex items-center justify-center gap-2 min-w-[140px] disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              PENSANDO...
            </>
          ) : (
            'GERAR LAB'
          )}
        </button>
      </div>

      {/* Feedback de erro amigável ao usuário */}
      {errorMsg && (
        <div className="mt-2 p-4 border-2 border-red-500 bg-red-50 rounded-xl text-xs text-red-700 font-semibold shadow-[4px_4px_0px_0px_rgba(239,68,68,0.2)]">
          {errorMsg}
        </div>
      )}

      {/* Watermark do rodapé */}
      <div className="mt-2 text-center">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 font-departure-mono">
          POWERED BY GOOGLE GEMINI
        </span>
      </div>
    </form>
  );
}

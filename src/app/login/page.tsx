'use client';

import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (registerMode) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Falha ao criar conta.');
          setLoading(false);
          return;
        }
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          registerMode
            ? 'Conta criada, mas falha ao entrar. Tente ENTRAR novamente.'
            : 'E-mail ou senha inválidos.'
        );
        setLoading(false);
        return;
      }

      window.location.href = '/';
    } catch {
      setError('Erro de rede. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-black font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md border-4 border-black bg-white p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col items-center mb-6">
          <div className="w-32 h-32 p-2 bg-zinc-100 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
            <Image
              src="/Logo-Mascote.png"
              alt="Mascote Wired Wordle — engrenagens e circuitos"
              width={112}
              height={112}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
            Wired Wordle
          </p>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-center">
          {registerMode ? 'Criar conta' : 'Entrar'}
        </h1>
        <p className="text-sm text-zinc-600 mb-8 text-center">
          Canvas isolado por usuário · Turso + Vercel
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              E-mail
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-4 border-black px-4 py-3 text-sm font-medium bg-white focus:outline-none focus:ring-0 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              placeholder="voce@exemplo.com"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Senha
            </span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={
                registerMode ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-4 border-black px-4 py-3 text-sm font-medium bg-white focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              placeholder="mínimo 8 caracteres"
            />
          </label>

          {error && (
            <p
              className="text-xs font-mono font-bold text-red-700 border-2 border-red-600 bg-red-50 px-3 py-2"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border-4 border-black bg-white py-4 text-sm font-extrabold uppercase tracking-[0.15em] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? '...' : registerMode ? 'CRIAR CONTA' : 'ENTRAR'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setRegisterMode(!registerMode);
            setError(null);
          }}
          className="mt-6 w-full text-xs font-mono text-zinc-600 underline underline-offset-4 hover:text-black"
        >
          {registerMode
            ? 'Já tem conta? Voltar para entrar'
            : 'Primeira vez? Criar conta'}
        </button>

        <p className="mt-8 text-[10px] font-mono text-zinc-500 text-center">
          <Link href="/playgrounds" className="underline">
            Playgrounds
          </Link>{' '}
          (público)
        </p>
      </div>
    </div>
  );
}

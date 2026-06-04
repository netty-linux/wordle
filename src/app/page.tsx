'use client';

import dynamic from 'next/dynamic';
import { signOut, useSession } from 'next-auth/react';

const Canvas = dynamic(() => import('../components/Canvas'), {
  ssr: false,
});

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      {session?.user?.email && (
        <div className="absolute top-3 right-3 z-[10000] flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] font-mono text-zinc-500 max-w-[180px] truncate">
            {session.user.email}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-[10px] font-mono uppercase tracking-wider border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-white hover:border-zinc-500"
          >
            Sair
          </button>
        </div>
      )}
      <Canvas id="default-canvas-room" />
    </main>
  );
}



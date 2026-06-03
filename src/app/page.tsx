'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('../components/Canvas'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-zinc-950">
      <Canvas id="default-canvas-room" />
    </main>
  );
}



import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Providers } from '../components/Providers';
import './globals.css';

export const metadata = {
  title: 'Wired Wordle Canvas',
  description: 'Collab whiteboard local-first engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning impede que extensões de navegador quebrem o app no modo dev
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-zinc-950 text-white antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}

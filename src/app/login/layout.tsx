import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar · Wired Wordle',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f1ea] text-black antialiased">
      {children}
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--fonte-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Central', template: '%s' },
  description: 'A plataforma interna da operação — Botanika e VermeFree.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

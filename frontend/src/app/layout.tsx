import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { QueryProvider } from '@/lib/QueryProvider';

export const metadata: Metadata = {
  title: 'Family Meal Planner',
  description: 'Piano pasti familiare con suggerimenti intelligenti',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

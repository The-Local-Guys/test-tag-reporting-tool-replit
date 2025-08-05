import { ReactNode } from 'react';
import { SiteHeader } from './site-header';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main>
        {children}
      </main>
    </div>
  );
}
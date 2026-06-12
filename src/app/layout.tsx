import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ModalProvider } from '@/components/ModalProvider';
import { ScanProvider } from '@/components/ScanProvider';
import { ClassifyProvider } from '@/components/ClassifyProvider';
import AppHeader from '@/components/AppHeader';
import { HeaderSlotProvider } from '@/components/HeaderSlot';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'photoshelf',
  description: 'Tu biblioteca de fotos personal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <AnalyticsProvider />
        <HeaderSlotProvider>
          <AppHeader />
          <ModalProvider>
            <ScanProvider>
              <ClassifyProvider>
                {children}
              </ClassifyProvider>
            </ScanProvider>
          </ModalProvider>
        </HeaderSlotProvider>
      </body>
    </html>
  );
}

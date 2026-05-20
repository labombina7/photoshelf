import type { Metadata } from 'next';
import './globals.css';
import { ModalProvider } from '@/components/ModalProvider';
import { ScanProvider } from '@/components/ScanProvider';

export const metadata: Metadata = {
  title: 'photoshelf',
  description: 'Tu biblioteca de fotos personal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ModalProvider>
          <ScanProvider>
            {children}
          </ScanProvider>
        </ModalProvider>
      </body>
    </html>
  );
}

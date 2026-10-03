import type { Metadata, Viewport } from 'next';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Holy Bible',
  description: 'The Holy Bible — the complete Bible, Genesis to Revelation, with its places, people, journeys and connections gently beside the text, and the text untouched.',
  manifest: './manifest.webmanifest',
  appleWebApp: { capable: true, title: 'The Holy Bible', statusBarStyle: 'black-translucent' },
  icons: { icon: './icons/icon-192.png', apple: './icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1c1714',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="paper">
      <body>{children}</body>
    </html>
  );
}

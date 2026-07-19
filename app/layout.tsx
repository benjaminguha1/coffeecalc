import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import '../src/styles.css';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ??
    requestHeaders.get('host') ??
    'coffeecalc-espresso.localhost';
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (host.includes('localhost') ? 'http' : 'https');
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = 'CoffeeCalc · Espresso dial-in';
  const description =
    'Dial in espresso recipes using dose, yield, and measured strength.';
  const image = new URL('/og-v2.png', metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    manifest: '/manifest.webmanifest',
    icons: { icon: '/coffee.svg' },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: image,
          width: 1672,
          height: 941,
          alt: 'CoffeeCalc espresso dial-in calculator',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

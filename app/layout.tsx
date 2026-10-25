import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocLedger AI',
  description: 'Hubdoc Statement Parser + QBO Ledger',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
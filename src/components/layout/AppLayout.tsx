'use client';
// File: src/components/layout/AppLayout.tsx

import React from 'react';
import { NavBar } from './NavBar';
import { Footer } from './Footer';
import { PwaSetup } from './PwaSetup';
import { FeedbackWidget } from './FeedbackWidget';
import { CookieConsentBanner } from './CookieConsentBanner';
import { ClientUXEnhancements } from './ClientUXEnhancements';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <NavBar />
      <main id="main-content" className="flex-1">{children}</main>
      <ClientUXEnhancements />
      <Footer />
      <PwaSetup />
      <FeedbackWidget />
      <CookieConsentBanner />
    </div>
  );
}

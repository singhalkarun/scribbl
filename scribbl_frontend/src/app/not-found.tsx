'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 animate-fadeIn">
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 text-center max-w-sm w-full">
        <h1 className="text-8xl font-display text-[var(--color-coral)] mb-4">
          404
        </h1>
        <p className="text-ink/70 mb-8 text-lg font-medium">
          Oops! This drawing seems to have been erased
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[var(--color-green)] border-[3px] border-ink rounded-scribbl-sm px-6 py-3 text-white font-bold shadow-scribbl-sm hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

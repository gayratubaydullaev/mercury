'use client';

import { Suspense } from 'react';
import { HomeProductGrid } from '@/app/home-product-grid';

function ProductGridFallback() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card aspect-square animate-pulse" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Fixed background blobs — only on desktop; on mobile omitted for smooth scroll */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-50 animate-blob will-change-transform" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-50 animate-blob [animation-delay:2s] will-change-transform" />
        <div className="absolute -bottom-8 left-1/3 w-[500px] h-[500px] bg-pink-400/20 rounded-full blur-[100px] mix-blend-multiply opacity-50 animate-blob [animation-delay:4s] will-change-transform" />
      </div>

      <section className="py-4 md:pt-2 md:pb-8 flex-1 touch-pan-y overscroll-y-contain">
        <Suspense fallback={<ProductGridFallback />}>
          <HomeProductGrid />
        </Suspense>
      </section>
    </div>
  );
}

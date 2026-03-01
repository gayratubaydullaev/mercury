'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type TabId = 'description' | 'reviews';

interface ProductTabsProps {
  description: React.ReactNode;
  reviews: React.ReactNode;
  reviewsCount?: number;
}

export function ProductTabs({ description, reviews, reviewsCount = 0 }: ProductTabsProps) {
  const [active, setActive] = useState<TabId>('description');
  const tabs: { id: TabId; label: string }[] = [
    { id: 'description', label: 'Tavsif' },
    { id: 'reviews', label: `Sharhlar${reviewsCount > 0 ? ` (${reviewsCount})` : ''}` },
  ];
  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'pb-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              active === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="py-4">
        {active === 'description' && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-line leading-relaxed">
            {description}
          </div>
        )}
        {active === 'reviews' && reviews}
      </div>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';

export type VariantOption = {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
};

export type VariantGroup = {
  id: string;
  name: string;
  type: 'text' | 'color';
  options: VariantOption[];
};

interface ProductVariantsProps {
  variants: VariantGroup[];
  selected: Record<string, string>;
  onChange: (groupId: string, value: string | null) => void;
  showError?: boolean;
  isModal?: boolean;
}

export function ProductVariants({
  variants,
  selected,
  onChange,
  showError = false,
  isModal = false,
}: ProductVariantsProps) {
  const handleSelect = (groupId: string, optionId: string) => {
    if (selected[groupId] === optionId) {
      onChange(groupId, null);
    } else {
      onChange(groupId, optionId);
    }
  };

  if (!variants.length) return null;

  return (
    <div className="space-y-1 py-0">
      {variants.map((group) => {
        const isMissing = showError && !selected[group.id];
        const selectedLabel = group.options.find((o) => o.id === selected[group.id])?.label;

        return (
          <div
            key={group.id}
            className={cn(
              'space-y-1.5 p-1 rounded-lg -ml-1 transition-colors',
              isMissing && 'bg-red-50/50 dark:bg-red-950/20'
            )}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className={cn('text-muted-foreground', isMissing && 'text-red-500 font-medium')}>
                {group.name}:
              </span>
              <span className="font-medium text-foreground">
                {selectedLabel ?? '—'}
              </span>
              {isMissing && (
                <span className="text-red-500 text-[10px] ml-auto animate-pulse">
                  Variantni tanlang
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const isSelected = selected[group.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(group.id, option.id)}
                    disabled={option.disabled}
                    className={cn(
                      'px-3 py-2 sm:py-1.5 text-xs sm:text-xs rounded-lg border transition-all min-w-[2.75rem] min-h-[2.5rem] sm:min-h-0 touch-manipulation',
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                        : isMissing
                          ? 'border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 bg-background'
                          : 'border-input hover:border-primary/50 text-foreground hover:bg-accent/50',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

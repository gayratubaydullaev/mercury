'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type SelectedOptions = Record<string, string>;

interface ProductOptionsProps {
  options: Record<string, string[]>;
  selected?: SelectedOptions;
  onChange?: (selected: SelectedOptions) => void;
}

export function ProductOptions({ options, selected = {}, onChange }: ProductOptionsProps) {
  const [local, setLocal] = useState<SelectedOptions>(() => selected);

  const update = (name: string, value: string) => {
    const next = { ...local, [name]: value };
    setLocal(next);
    onChange?.(next);
  };

  const entries = Object.entries(options);
  if (!entries.length) return null;

  return (
    <div className="space-y-4 mt-4">
      {entries.map(([name, values]) => (
        <div key={name}>
          <span className="text-sm font-medium text-muted-foreground block mb-2">{name}</span>
          <div className="flex flex-wrap gap-2">
            {values.map((value) => {
              const isSelected = (local[name] ?? values[0]) === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update(name, value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md border text-sm transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:border-primary/50'
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

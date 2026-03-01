'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type Category = { id: string; name: string; slug: string; parentId: string | null; children?: Category[] };

export function CatalogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiFetch(`${API_URL}/categories?parentId=null`)
      .then((r) => r.json())
      .then((roots: Category[]) => setCategories(roots ?? []))
      .catch(() => setCategories([]));
  }, []);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/catalog?${p.toString()}`);
  };

  const leafCategories = categories.flatMap((c) => (c.children ?? []));
  const currentCategory = searchParams.get('category') ?? '';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const searchFromUrl = searchParams.get('search') ?? '';

  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:gap-4 md:items-end">
      {/* 1. Kategoriya */}
      <div className="w-full md:w-auto md:min-w-[140px]">
        <label className="text-xs text-muted-foreground block mb-1.5">Kategoriya</label>
        <select
          className="w-full rounded-lg border border-input bg-background h-11 px-3 text-sm md:min-w-[140px]"
          value={currentCategory}
          onChange={(e) => setParam('category', e.target.value)}
        >
          <option value="">Barchasi</option>
          {leafCategories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>
      {/* 2. Narx */}
      <div className="w-full md:w-auto">
        <label className="text-xs text-muted-foreground block mb-1.5">Narx (soʻm)</label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            className="flex-1 min-w-0 h-11 text-sm md:w-24 md:flex-none"
            value={minPrice}
            onChange={(e) => setParam('minPrice', e.target.value.replace(/\D/g, ''))}
          />
          <span className="text-muted-foreground shrink-0">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            className="flex-1 min-w-0 h-11 text-sm md:w-24 md:flex-none"
            value={maxPrice}
            onChange={(e) => setParam('maxPrice', e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
      {/* 3. Saralash */}
      <div className="w-full md:w-auto">
        <label className="text-xs text-muted-foreground block mb-1.5">Saralash</label>
        <select
          className="w-full rounded-lg border border-input bg-background h-11 px-3 text-sm md:min-w-[120px]"
          value={searchParams.get('sortBy') ?? (searchFromUrl.trim() ? 'relevance' : 'createdAt')}
          onChange={(e) => {
            const v = e.target.value;
            const p = new URLSearchParams(searchParams.toString());
            p.set('sortBy', v);
            p.set('sortOrder', v === 'price' ? 'asc' : 'desc');
            router.push(`/catalog?${p.toString()}`);
          }}
        >
          {searchFromUrl.trim() && <option value="relevance">Relevansiya</option>}
          <option value="createdAt">Yangi</option>
          <option value="price">Narx</option>
        </select>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductShareBtnProps {
  productName: string;
  productId: string;
  className?: string;
  iconClassName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/** Copy text without using Clipboard API (avoids "access to other apps" permission). */
function copyTextFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
}

export function ProductShareBtn({
  productName,
  productId,
  className,
  iconClassName,
  variant = 'outline',
  size = 'icon',
}: ProductShareBtnProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/product/${productId}`;

    // Copy link without using navigator.clipboard or navigator.share,
    // so the site does not request "access to other applications" permission.
    const didCopy = copyTextFallback(url);
    if (didCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Fallback: show URL so user can copy manually
      window.prompt('Linkni nusxalash uchun (Ctrl+C):', url);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      className={cn('rounded-full', className)}
      title={copied ? 'Link nusxalandi' : 'Ulashish'}
    >
      <Share2 className={cn('h-5 w-5', iconClassName)} />
    </Button>
  );
}

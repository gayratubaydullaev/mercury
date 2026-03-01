import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';

export function ProductTrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
      <div className="flex flex-col items-center text-center gap-1">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Yetkazib berish</span>
        <span className="text-[10px] text-muted-foreground">Oʻzbekiston boʻylab</span>
      </div>
      <div className="flex flex-col items-center text-center gap-1">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Xavfsiz toʻlov</span>
        <span className="text-[10px] text-muted-foreground">Click, Payme</span>
      </div>
      <div className="flex flex-col items-center text-center gap-1">
        <RotateCcw className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Qaytarish</span>
        <span className="text-[10px] text-muted-foreground">14 kun ichida</span>
      </div>
    </div>
  );
}

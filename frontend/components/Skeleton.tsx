export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5" aria-hidden="true">
      <SkeletonLine className="h-3 w-1/2 mb-3" />
      <SkeletonLine className="h-8 w-2/5 mb-2" />
      <SkeletonLine className="h-3 w-3/4" />
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-5 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3 mb-3">
        <SkeletonLine className="h-5 w-1/3" />
        <SkeletonLine className="h-5 w-14" />
      </div>
      <SkeletonLine className="h-3 w-1/4 mb-1" />
      <SkeletonLine className="h-3 w-2/5" />
    </div>
  );
}

export function SkeletonProfileItem() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3" aria-hidden="true">
      <SkeletonLine className="h-6 w-16 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-4/5" />
      </div>
    </div>
  );
}

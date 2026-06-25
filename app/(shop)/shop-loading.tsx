// Destination : app/(shop)/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <main className="pb-36">
      <div className="px-4 mt-4">
        <Skeleton className="h-[220px] w-full rounded-3xl" />
      </div>

      <div className="mt-7 px-4 flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 flex-shrink-0 rounded-full" />
        ))}
      </div>

      <div className="mt-7 px-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  );
}

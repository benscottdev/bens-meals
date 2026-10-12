import { PageTitle } from "./ui";

const Bar = ({ w, h = "h-3" }: { w: string; h?: string }) => <div className={`${h} ${w} animate-pulse rounded-[2px] bg-line/70`} />;

/** Shown the instant a tab is tapped, while the server fetches the page's data. */
export function PageSkeleton({ title, sub = true, variant = "list" }: { title?: string; sub?: boolean; variant?: "list" | "week" | "recipe" }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {title ? (
        <PageTitle sub={sub ? <span className="inline-block h-2.5 w-40 animate-pulse rounded-[2px] bg-line/70 align-middle" /> : undefined}>{title}</PageTitle>
      ) : (
        <div className="mb-8 space-y-4"><Bar w="w-32" h="h-2.5" /><Bar w="w-3/4" h="h-10" /></div>
      )}

      {variant === "week" && (
        <>
          <div className="space-y-4 border-t border-line pt-5"><Bar w="w-48" h="h-8" /><Bar w="w-full" h="h-px" /><Bar w="w-5/6" /><Bar w="w-2/3" /></div>
          <div className="mt-10">
            {[0, 1, 2].map((d) => (
              <div key={d} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-t border-line py-5">
                <div className="space-y-2"><Bar w="w-10" h="h-4" /><Bar w="w-12" h="h-2.5" /></div>
                <div className="space-y-5">
                  {[0, 1, 2].map((m) => <div key={m} className="space-y-2"><Bar w="w-16" h="h-2.5" /><Bar w="w-3/4" h="h-4" /><Bar w="w-1/2" h="h-2.5" /></div>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "recipe" && (
        <div className="space-y-4">
          <Bar w="w-2/3" /><Bar w="w-1/2" />
          <div className="mt-6 grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-16" />)}</div>
          <Bar w="w-full" h="h-14" />
          <div className="space-y-3 border-t border-line pt-6">{[0, 1, 2, 3, 4].map((i) => <Bar key={i} w={i % 2 ? "w-3/4" : "w-5/6"} />)}</div>
        </div>
      )}

      {variant === "list" && (
        <div className="space-y-3 border-t border-line pt-5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line pb-3">
              <div className="flex-1 space-y-2"><Bar w={i % 3 ? "w-2/3" : "w-1/2"} h="h-4" /><Bar w="w-1/3" h="h-2.5" /></div>
              <Bar w="w-12" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CARD_SKELETONS = 6;

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-[linear-gradient(180deg,#f6f1e8_0%,#f5efe6_100%)] text-ink"
    >
      <span className="sr-only">Loading Product Hunt launches</span>

      <section className="border-b border-black/10 bg-white/55">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="h-7 w-48 animate-pulse rounded-full bg-black/10" />
              <div className="space-y-2">
                <div className="h-10 w-72 max-w-full animate-pulse rounded-md bg-black/10" />
                <div className="h-5 w-[32rem] max-w-full animate-pulse rounded-md bg-black/8" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  className="h-[4.25rem] min-w-28 animate-pulse rounded-md border border-black/10 bg-white/75"
                  key={index}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div className="space-y-2" key={index}>
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                <div className="h-10 animate-pulse rounded-md border border-black/10 bg-white/80" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 h-12 animate-pulse rounded-md border border-black/10 bg-white/70" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: CARD_SKELETONS }, (_, index) => (
            <div
              className="space-y-4 rounded-lg border border-black/10 bg-white/90 p-4 shadow-sm"
              key={index}
            >
              <div className="aspect-[16/10] animate-pulse rounded-md bg-black/10" />
              <div className="h-5 w-2/3 animate-pulse rounded-md bg-black/10" />
              <div className="h-4 w-full animate-pulse rounded-md bg-black/8" />
              <div className="h-16 animate-pulse rounded-md bg-black/8" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

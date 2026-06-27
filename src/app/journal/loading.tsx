// On-brand loading skeleton for the /journal segment.
export default function JournalLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="skeleton mt-2 h-4 w-24 rounded" />
        </div>
        <div className="skeleton h-9 w-20 rounded-full" />
      </div>
      <div className="columns-2 gap-4 sm:columns-3 [column-fill:_balance]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-4 break-inside-avoid">
            <div className="skeleton aspect-square w-full rounded-2xl" />
            <div className="skeleton mt-2 h-3 w-3/4 rounded" />
            <div className="skeleton mt-1 h-2 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

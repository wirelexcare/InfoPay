interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  itemCount: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function Pagination({
  page,
  limit,
  total,
  itemCount,
  onPageChange,
  itemLabel = "items",
}: PaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = start + itemCount - 1;

  return (
    <div className="mt-6 flex items-center justify-between">
      <p className="text-sm text-ink-600">
        Showing {start}-{end} of {total} {itemLabel}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-50 hover:bg-ink-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page * limit >= total}
          className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-50 hover:bg-ink-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

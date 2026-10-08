import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function useWorkspacePage<T>(items: T[], pageSize = 8, resetKey = "") {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [resetKey]);
  const page = Math.min(offset, Math.max(0, Math.ceil(items.length / pageSize) - 1));
  return {
    items: items.slice(page * pageSize, (page + 1) * pageSize),
    page, setPage: setOffset, pageSize, total: items.length,
  };
}

type PaginationProps = {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  total: number;
};

export function WorkspacePagination({ page, setPage, pageSize, total }: PaginationProps) {
  const range = total
    ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`
    : "0 records";
  return (
    <div className="workspace-pagination">
      <span className="text-sm text-muted-foreground" aria-live="polite">{range}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

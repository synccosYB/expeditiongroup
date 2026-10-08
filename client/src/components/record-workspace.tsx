import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspacePage, WorkspacePagination } from "@/components/workspace-pagination";

type RecordWorkspaceProps<T> = {
  records: T[];
  columns: { label: string; render: (record: T) => ReactNode }[];
  title: (record: T) => string;
  href: (record: T) => string;
  details: (record: T) => ReactNode;
  actions: (record: T) => ReactNode;
};

export function RecordWorkspace<T extends { id: number }>({
  records, columns, title, href, details, actions,
}: RecordWorkspaceProps<T>) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const paging = useWorkspacePage(records);
  const selected = paging.items.find(record => record.id === selectedId) ?? paging.items[0];

  return (
    <div className="workspace-split">
      <div className="min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(column => <TableHead key={column.label}>{column.label}</TableHead>)}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paging.items.map(record => (
              <TableRow key={record.id} data-state={selected?.id === record.id ? "selected" : undefined}>
                {columns.map((column, index) => (
                  <TableCell key={column.label}>
                    {index === 0 ? (
                      <button
                        className="text-left font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setSelectedId(record.id)}
                        aria-label={`Preview ${title(record)}`}
                      >
                        {column.render(record)}
                      </button>
                    ) : column.render(record)}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(record.id)}>Preview</Button>
                    {actions(record)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <WorkspacePagination {...paging} />
      </div>
      <aside className="workspace-detail flex flex-col gap-5" aria-label="Record preview">
        {selected && (
          <>
            <h2 className="text-lg font-semibold">{title(selected)}</h2>
            {details(selected)}
            <Button asChild className="mt-auto"><Link href={href(selected)}>Open record</Link></Button>
          </>
        )}
      </aside>
    </div>
  );
}

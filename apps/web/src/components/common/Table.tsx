import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found.',
  onRowClick,
  className,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-12 bg-slate-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={twMerge('w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold uppercase tracking-wider text-slate-600">
            {columns.map((col, idx) => (
              <th key={idx} className={twMerge('px-5 py-3.5', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-8 text-center text-sm text-slate-500 font-medium"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr
                key={item.id || rowIdx}
                onClick={() => onRowClick && onRowClick(item)}
                className={clsx(
                  'transition-colors hover:bg-slate-50/80',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={twMerge('px-5 py-3.5', col.className)}>
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                        ? String(item[col.accessorKey] ?? '')
                        : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

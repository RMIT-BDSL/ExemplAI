import { Component, Show, createSignal } from 'solid-js';
import {
  createSolidTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/solid-table';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import { getColumns } from './columns';
import type { InvitationCode } from './types';

interface Props {
  data: InvitationCode[];
  onRefetch: () => void;
}

const InvitationCodesTable: Component<Props> = (props) => {
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [globalFilter, setGlobalFilter] = createSignal('');
  const [actionError, setActionError] = createSignal('');

  const handleInvalidate = async (code: string) => {
    setActionError('');
    try {
      await convex.mutation(api.invitationCodes.invalidateCode, { code });
      props.onRefetch();
    } catch (err: any) {
      setActionError(err.message || 'Failed to invalidate code');
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete code "${code}"? This cannot be undone.`)) return;
    setActionError('');
    try {
      await convex.mutation(api.invitationCodes.remove, { code });
      props.onRefetch();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete code');
    }
  };

  const table = createSolidTable({
    get data() {
      return props.data;
    },
    columns: getColumns(handleInvalidate, handleDelete),
    state: {
      get sorting() {
        return sorting();
      },
      get globalFilter() {
        return globalFilter();
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div class="rounded-md border border-line bg-white overflow-hidden">
      <div class="px-6 py-4 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-baseline gap-2.5">
          <h2 class="font-display text-xl text-ink">All codes</h2>
          <span class="font-mono text-xs text-muted tabular-nums">
            {props.data.length} {props.data.length === 1 ? 'code' : 'codes'}
          </span>
        </div>
        <div class="relative w-full sm:w-64">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search codes…"
            value={globalFilter()}
            onInput={(e) => setGlobalFilter(e.currentTarget.value)}
            class="w-full rounded-md border border-line bg-white pl-9 pr-3 py-2 text-sm text-ink placeholder-muted outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition"
          />
        </div>
      </div>

      <Show when={actionError()}>
        <div class="mx-6 mt-4 rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet">
          {actionError()}
        </div>
      </Show>

      <Show
        when={table.getRowModel().rows.length > 0}
        fallback={
          <div class="px-6 py-16 text-center">
            <p class="font-display text-lg text-ink">
              {globalFilter() ? 'No codes match your search.' : 'No codes yet.'}
            </p>
            <Show when={!globalFilter()}>
              <p class="mt-1.5 text-sm text-muted">Create your first code with the form above.</p>
            </Show>
          </div>
        }
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr class="bg-paper/60 border-b border-line">
                  {hg.headers.map((header) => (
                    <th
                      class="text-left px-6 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted font-medium cursor-pointer select-none hover:text-ink transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span class="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && ' ↑'}
                        {header.column.getIsSorted() === 'desc' && ' ↓'}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr class="border-b border-line/70 last:border-0 hover:bg-paper/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td class="px-6 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
};

export default InvitationCodesTable;

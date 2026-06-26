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
    get data() { return props.data; },
    columns: getColumns(handleInvalidate, handleDelete),
    state: {
      get sorting() { return sorting(); },
      get globalFilter() { return globalFilter(); },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold text-white">All Codes</h2>
          <span class="text-xs text-slate-500">{props.data.length} total</span>
        </div>
        <input
          type="text"
          placeholder="Search codes…"
          value={globalFilter()}
          onInput={(e) => setGlobalFilter(e.currentTarget.value)}
          class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-500 transition w-full sm:w-56"
        />
      </div>

      <Show when={actionError()}>
        <div class="mx-6 mt-4 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-400">
          {actionError()}
        </div>
      </Show>

      <Show
        when={table.getRowModel().rows.length > 0}
        fallback={
          <div class="px-6 py-12 text-center text-slate-500 text-sm">
            {globalFilter() ? 'No codes match your search.' : 'No invitation codes yet.'}
          </div>
        }
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr class="text-xs uppercase text-slate-500 border-b border-slate-800">
                  {hg.headers.map((header) => (
                    <th
                      class="text-left px-6 py-3 font-semibold tracking-wider cursor-pointer select-none"
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
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                  {row.getVisibleCells().map((cell) => (
                    <td class="px-6 py-4">
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

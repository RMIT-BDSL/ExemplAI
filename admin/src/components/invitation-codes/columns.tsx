import { Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import type { InvitationCode } from './types';

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function StatusBadge(props: { code: InvitationCode }) {
  const active = () => props.code.isValid && props.code.usesCount < props.code.quantity;
  return (
    <Show
      when={active()}
      fallback={
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Used / Invalid
        </span>
      }
    >
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/40 text-emerald-400 text-xs font-medium">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    </Show>
  );
}

export function getColumns(
  onInvalidate: (code: string) => void,
  onDelete: (code: string) => void,
): ColumnDef<InvitationCode>[] {
  return [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: (info) => (
        <span class="font-mono text-sky-300 font-semibold tracking-widest">
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: 'isValid',
      header: 'Status',
      cell: (info) => <StatusBadge code={info.row.original} />,
    },
    {
      id: 'uses',
      header: 'Uses',
      accessorFn: (row) => `${row.usesCount} / ${row.quantity}`,
      cell: (info) => (
        <span class="text-slate-300 tabular-nums">{info.getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'expiryDate',
      header: 'Expires',
      cell: (info) => (
        <span class="text-slate-400">{formatDate(info.getValue<string | undefined>())}</span>
      ),
    },
    {
      accessorKey: 'createdBy',
      header: 'Created By',
      cell: (info) => (
        <span class="text-slate-400">{info.getValue<string | undefined>() || '—'}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (info) => {
        const row = info.row.original;
        const active = row.isValid && row.usesCount < row.quantity;
        return (
          <div class="flex items-center gap-2 justify-end">
            <Show when={active}>
              <button
                onClick={() => onInvalidate(row.code)}
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-700/50 text-amber-400 hover:bg-amber-900/30 transition"
              >
                Invalidate
              </button>
            </Show>
            <button
              onClick={() => onDelete(row.code)}
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-700/50 text-red-400 hover:bg-red-900/30 transition"
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];
}

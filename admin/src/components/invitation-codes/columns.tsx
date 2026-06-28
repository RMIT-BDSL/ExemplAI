import { createSignal, Show } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import type { InvitationCode } from './types';

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpired(c: InvitationCode) {
  if (!c.expiryDate) return false;
  const d = new Date(c.expiryDate);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

type Status = { label: string; class: string; dot: string };

function statusOf(c: InvitationCode): Status {
  if (!c.isValid) return { label: 'Invalid', class: 'text-garnet ring-garnet/25 bg-garnet/[0.05]', dot: 'bg-garnet' };
  if (isExpired(c)) return { label: 'Expired', class: 'text-brass ring-brass/30 bg-brass/[0.06]', dot: 'bg-brass' };
  if (c.usesCount >= c.quantity) return { label: 'Used', class: 'text-muted ring-line bg-paper', dot: 'bg-muted' };
  return { label: 'Active', class: 'text-ivy ring-ivy/25 bg-ivy/[0.06]', dot: 'bg-ivy' };
}

function StatusBadge(props: { code: InvitationCode }) {
  const s = () => statusOf(props.code);
  return (
    <span class={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider ring-1 ring-inset ${s().class}`}>
      <span class={`w-1.5 h-1.5 rounded-full ${s().dot}`} />
      {s().label}
    </span>
  );
}

function CodeCell(props: { code: string }) {
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy code"
      class="group inline-flex items-center gap-2 rounded px-1.5 -mx-1.5 py-1 hover:bg-paper transition-colors"
    >
      <span class="font-mono text-sm font-medium tracking-[0.2em] text-ink">{props.code}</span>
      <Show
        when={copied()}
        fallback={
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" class="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75h-6a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
        }
      >
        <span class="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ivy">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Copied
        </span>
      </Show>
    </button>
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
      cell: (info) => <CodeCell code={info.getValue<string>()} />,
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
      cell: (info) => <span class="font-mono text-[13px] text-body tabular-nums">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: 'expiryDate',
      header: 'Expires',
      cell: (info) => <span class="text-body">{formatDate(info.getValue<string | undefined>())}</span>,
    },
    {
      accessorKey: 'createdBy',
      header: 'Created by',
      cell: (info) => <span class="text-muted">{info.getValue<string | undefined>() || '—'}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: (info) => {
        const row = info.row.original;
        const active = row.isValid && row.usesCount < row.quantity && !isExpired(row);
        return (
          <div class="flex items-center gap-2 justify-end">
            <Show when={active}>
              <button
                onClick={() => onInvalidate(row.code)}
                class="rounded-md border border-brass/40 bg-white px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass/[0.06] transition-colors"
              >
                Invalidate
              </button>
            </Show>
            <button
              onClick={() => onDelete(row.code)}
              class="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-garnet hover:bg-garnet/[0.05] hover:border-garnet/40 transition-colors"
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];
}

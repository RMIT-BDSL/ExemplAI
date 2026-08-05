import { Component, For, Show } from 'solid-js';
import type { ReleaseNote, ReleaseNoteType } from './types';

interface Props {
  notes: ReleaseNote[];
}

const TYPE_META: Record<ReleaseNoteType, { label: string; class: string; dot: string }> = {
  feature: { label: 'Feature', class: 'text-ivy ring-ivy/25 bg-ivy/[0.06]', dot: 'bg-ivy' },
  improvement: { label: 'Improvement', class: 'text-brass ring-brass/30 bg-brass/[0.06]', dot: 'bg-brass' },
  fix: { label: 'Fix', class: 'text-garnet ring-garnet/25 bg-garnet/[0.05]', dot: 'bg-garnet' },
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TypeBadge(props: { type: ReleaseNoteType }) {
  const m = () => TYPE_META[props.type];
  return (
    <span class={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider ring-1 ring-inset ${m().class}`}>
      <span class={`w-1.5 h-1.5 rounded-full ${m().dot}`} />
      {m().label}
    </span>
  );
}

export function ReleaseNotesList(props: Props) {
  return (
    <div class="rounded-md border border-line bg-white overflow-hidden">
      <div class="px-6 pt-5 pb-4 border-b border-line">
        <h2 class="font-display text-xl text-ink">Published notes</h2>
        <p class="mt-1 text-sm text-body">
          Everything you have announced, newest first.
        </p>
      </div>

      <Show
        when={props.notes.length > 0}
        fallback={
          <div class="px-6 py-14 text-center text-sm text-muted">
            No release notes yet. Publish your first one above.
          </div>
        }
      >
        <ul class="divide-y divide-line">
          <For each={props.notes}>
            {(note) => (
              <li class="px-6 py-5 flex flex-col gap-2">
                <div class="flex flex-wrap items-center gap-2.5">
                  <TypeBadge type={note.type} />
                  <span class="text-xs text-muted font-mono">{formatDate(note.timestamp)}</span>
                </div>
                <h3 class="font-display text-lg text-ink leading-snug">{note.title}</h3>
                <p class="text-sm text-body whitespace-pre-line">{note.content}</p>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

export default ReleaseNotesList;

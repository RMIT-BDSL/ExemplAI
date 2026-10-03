import { Component, For, Show, createMemo } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type Updater,
} from '@tanstack/solid-table';
import { api } from '../lib/webConvexApi';
import type { StudentList, StudentRow } from '../components/students/types';
import {
  BandChart,
  LiveDot,
  MasteryRule,
  ModeTag,
  StatusText,
  ago,
  createLiveQuery,
  displayName,
  fullDate,
  pct,
} from '../components/students/parts';

type Filter = 'all' | 'active' | 'idle';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Started a lesson' },
  { value: 'idle', label: 'Not started' },
];

const STATUS_ORDER = { pending: 0, 'in-progress': 1, completed: 2 } as const;

const columns: ColumnDef<StudentRow>[] = [
  {
    id: 'student',
    header: 'Student',
    accessorFn: (s) => displayName(s).toLowerCase(),
    cell: (info) => {
      const s = info.row.original;
      return (
        <>
          <A href={`/students/${s.userId}`} class="font-medium text-ink hover:text-garnet hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-garnet rounded-sm">
            {displayName(s)}
          </A>
          <p class="font-mono text-[11px] text-muted truncate max-w-56">{s.email}</p>
        </>
      );
    },
  },
  {
    id: 'workingOn',
    header: 'Working on',
    accessorFn: (s) => (s.current ? s.current.week * 1000 : undefined),
    sortUndefined: 'last',
    cell: (info) => {
      const c = info.row.original.current;
      return (
        <Show when={c} fallback={<span class="text-muted">Hasn't opened a lesson</span>}>
          <p class="text-ink">
            <span class="font-mono text-[11px] text-muted mr-1.5">W{c!.week}</span>
            {c!.name}
          </p>
          <p class="font-mono text-[11px] text-muted" title={c!.topic ?? undefined}>{c!.kc ?? 'no topic'}</p>
        </Show>
      );
    },
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (s) => (s.current ? STATUS_ORDER[s.current.status] : undefined),
    sortUndefined: 'last',
    cell: (info) => {
      const c = info.row.original.current;
      return (
        <Show when={c} fallback={<span class="text-muted">—</span>}>
          <StatusText status={c!.status} />
          <Show when={c!.failedSubmits > 0}>
            <p class="text-[11px] text-muted">{c!.failedSubmits} failed Submit{c!.failedSubmits === 1 ? '' : 's'}</p>
          </Show>
        </Show>
      );
    },
  },
  {
    id: 'mastery',
    header: 'Topic mastery',
    meta: { hint: "BKT mastery of the current lesson's topic. Ticks: 0.30 and 0.70 switch example mode; 0.95 is mastered." },
    accessorFn: (s) => s.current?.mastery ?? undefined,
    sortUndefined: 'last',
    cell: (info) => {
      const c = info.row.original.current;
      return (
        <Show when={c} fallback={<span class="text-muted">—</span>}>
          <div class="flex items-center gap-2">
            <MasteryRule value={c!.mastery} compact />
            <ModeTag mode={c!.mode} />
          </div>
        </Show>
      );
    },
  },
  {
    id: 'examples',
    header: 'Examples',
    meta: { hint: 'Examples given in the current round of this lesson, out of 3' },
    enableSorting: false,
    cell: (info) => {
      const c = info.row.original.current;
      return (
        <Show when={c} fallback={<span class="text-muted">—</span>}>
          <span class="font-mono text-[12px] tabular-nums">{c!.examples.used} of {c!.examples.cap}</span>
          <p class="font-mono text-[11px] text-muted">{c!.examples.remaining} available</p>
        </Show>
      );
    },
  },
  {
    id: 'firstTry',
    header: 'First try',
    meta: { hint: 'Lessons passed on the first Submit, out of lessons submitted' },
    accessorFn: (s) => s.firstTryRate ?? undefined,
    sortUndefined: 'last',
    cell: (info) => {
      const s = info.row.original;
      return (
        <Show when={s.submitted > 0} fallback={<span class="text-muted">no Submits</span>}>
          <span class="font-mono text-[12px] tabular-nums text-ink">{pct(s.firstTryRate)}</span>
          <p class="font-mono text-[11px] text-muted">{s.firstTry} of {s.submitted}</p>
        </Show>
      );
    },
  },
  {
    id: 'lastActive',
    header: 'Last active',
    accessorFn: (s) => s.lastActivityAt ?? undefined,
    sortUndefined: 'last',
    sortDescFirst: true,
    cell: (info) => {
      const at = info.row.original.lastActivityAt;
      return <span class="whitespace-nowrap" title={at ? fullDate(at) : undefined}>{ago(at)}</span>;
    },
  },
];

const DEFAULT_SORT: SortingState = [{ id: 'lastActive', desc: true }];

// Sorting lives in the URL as `sort=column` or `sort=-column` (descending).
const parseSort = (raw?: string): SortingState =>
  raw ? [{ id: raw.replace(/^-/, ''), desc: raw.startsWith('-') }] : DEFAULT_SORT;

const StudentsPage: Component = () => {
  const [params, setParams] = useSearchParams<{ q?: string; sort?: string; show?: Filter }>();
  const { data, error } = createLiveQuery<StudentList>(api.students.listStudents, () => ({}));

  const show = () => params.show ?? 'all';
  const q = () => (params.q ?? '').trim().toLowerCase();
  const sorting = () => parseSort(params.sort);

  const rows = createMemo(() => {
    let list = data()?.students ?? [];
    if (show() === 'active') list = list.filter((s) => s.started > 0);
    if (show() === 'idle') list = list.filter((s) => s.started === 0);
    if (q()) {
      list = list.filter((s) =>
        [s.name, s.email, s.current?.name, s.current?.kc, s.current?.topic].some((v) => v?.toLowerCase().includes(q())),
      );
    }
    return list;
  });

  const table = createSolidTable({
    get data() {
      return rows();
    },
    columns,
    state: {
      get sorting() {
        return sorting();
      },
    },
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting()) : updater;
      const first = next[0];
      const isDefault = !first || (first.id === 'lastActive' && first.desc);
      setParams({ sort: isDefault ? undefined : `${first.desc ? '-' : ''}${first.id}` });
    },
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const summary = () => data()?.summary;

  return (
    <div class="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-9 sm:py-12">
      <header class="border-b border-line pb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Students</p>
          <h1 class="mt-3 font-display text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.01em] text-ink">
            How students are doing
          </h1>
          <p class="mt-2 max-w-2xl text-[15px] text-body">
            What each student is working on now, how often they pass on the first Submit, and how that changes with mastery.
          </p>
        </div>
        <LiveDot ok={!error()} />
      </header>

      <Show when={error()}>
        <div role="alert" class="mt-6 rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">
          Couldn't load students: {error()!.message}. The page will update when the connection is back.
        </div>
      </Show>

      {/* Summary strip */}
      <section aria-label="Summary" class="mt-8 grid grid-cols-2 lg:grid-cols-4 border border-line rounded-md bg-white overflow-hidden">
        <Figure
          label="Students"
          value={summary() ? String(summary()!.students) : null}
          note={summary() ? `${summary()!.active} have started a lesson` : ''}
          class="border-r border-b lg:border-b-0"
        />
        <Figure
          label="Active this week"
          value={summary() ? String(summary()!.activeThisWeek) : null}
          note="did something in the last 7 days"
          class="border-b lg:border-b-0 lg:border-r"
        />
        <Figure
          label="First-try pass rate"
          value={summary() ? pct(summary()!.firstTryRate) : null}
          note={summary() ? `${summary()!.firstTry} of ${summary()!.submitted} submitted lessons` : ''}
          tone="ivy"
          class="border-r"
        />
        <Figure
          label="Topics mastered"
          value={summary() ? String(summary()!.topicsMastered) : null}
          note="across all students (mastery ≥ 0.95)"
        />
      </section>

      {/* Controls — kept in the URL so a view can be shared or bookmarked */}
      <div class="mt-8 flex flex-col md:flex-row md:items-end gap-3">
        <label class="flex-1 min-w-0">
          <span class="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5">Search</span>
          <input
            type="search"
            value={params.q ?? ''}
            onInput={(e) => setParams({ q: e.currentTarget.value || undefined }, { replace: true })}
            placeholder="Name, email, lesson or topic"
            class="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15"
          />
        </label>
        <div>
          <span class="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5">Show</span>
          <div role="group" aria-label="Show" class="inline-flex rounded-md border border-line bg-white p-0.5">
            <For each={FILTERS}>
              {(f) => (
                <button
                  type="button"
                  aria-pressed={show() === f.value}
                  onClick={() => setParams({ show: f.value === 'all' ? undefined : f.value })}
                  class="px-3 py-1.5 text-sm rounded-[5px] transition-colors"
                  classList={{ 'bg-ink text-paper': show() === f.value, 'text-body hover:text-ink': show() !== f.value }}
                >
                  {f.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Student table */}
      <section class="mt-4 rounded-md border border-line bg-white overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <caption class="sr-only">Students and their current lesson. Select a column heading to sort.</caption>
            <thead>
              <For each={table.getHeaderGroups()}>
                {(hg) => (
                  <tr class="bg-paper/60 border-b border-line">
                    <For each={hg.headers}>
                      {(header) => {
                        const sorted = () => header.column.getIsSorted();
                        const hint = (header.column.columnDef.meta as { hint?: string } | undefined)?.hint;
                        return (
                          <th
                            scope="col"
                            aria-sort={sorted() === 'asc' ? 'ascending' : sorted() === 'desc' ? 'descending' : undefined}
                            class="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted font-medium whitespace-nowrap"
                            title={hint}
                          >
                            <Show
                              when={header.column.getCanSort()}
                              fallback={flexRender(header.column.columnDef.header, header.getContext())}
                            >
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                class="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-ink focus-visible:outline-2 focus-visible:outline-garnet rounded-sm"
                                classList={{ 'text-ink': !!sorted() }}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                <span aria-hidden="true" class="w-2">{sorted() === 'asc' ? '↑' : sorted() === 'desc' ? '↓' : ''}</span>
                              </button>
                            </Show>
                          </th>
                        );
                      }}
                    </For>
                  </tr>
                )}
              </For>
            </thead>
            <tbody class="divide-y divide-line/70">
              <Show
                when={data()}
                fallback={
                  <For each={[0, 1, 2, 3]}>
                    {() => (
                      <tr>
                        <td colspan={columns.length} class="px-4 py-4">
                          <div class="h-5 rounded bg-line/60 animate-pulse motion-reduce:animate-none" />
                        </td>
                      </tr>
                    )}
                  </For>
                }
              >
                <Show
                  when={table.getRowModel().rows.length}
                  fallback={
                    <tr>
                      <td colspan={columns.length} class="px-4 py-12 text-center text-sm text-muted">
                        {data()!.students.length ? 'No students match these filters.' : 'No students yet. They appear here after redeeming an invitation code.'}
                      </td>
                    </tr>
                  }
                >
                  <For each={table.getRowModel().rows}>
                    {(row) => (
                      <tr class="hover:bg-paper/50 transition-colors">
                        <For each={row.getVisibleCells()}>
                          {(cell) => <td class="px-4 py-3 align-top text-body">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>}
                        </For>
                      </tr>
                    )}
                  </For>
                </Show>
              </Show>
            </tbody>
          </table>
        </div>
      </section>

      <div class="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        <div class="lg:col-span-3">
          <Show
            when={summary()}
            fallback={<div class="h-72 rounded-md border border-line bg-white/50 animate-pulse motion-reduce:animate-none" />}
          >
            <BandChart bands={summary()!.firstTryByBand} scope="students" />
          </Show>
        </div>
        <Definitions />
      </div>
    </div>
  );
};

const Figure: Component<{ label: string; value: string | null; note: string; tone?: 'ivy'; class?: string }> = (props) => (
  <div class={`px-5 py-6 border-line ${props.class ?? ''}`}>
    <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{props.label}</p>
    <Show when={props.value !== null} fallback={<div class="mt-2 h-9 w-16 rounded bg-line/70 animate-pulse motion-reduce:animate-none" />}>
      <p class="mt-1.5 font-display text-[34px] sm:text-[38px] leading-none tabular-nums" classList={{ 'text-ivy': props.tone === 'ivy', 'text-ink': props.tone !== 'ivy' }}>
        {props.value}
      </p>
    </Show>
    <p class="mt-2 text-xs text-muted">{props.note}</p>
  </div>
);

const Definitions: Component = () => (
  <section class="lg:col-span-2 rounded-md border border-line bg-white p-5 text-sm text-body">
    <h2 class="font-display text-lg text-ink">How these are counted</h2>
    <dl class="mt-3 space-y-2.5">
      <div>
        <dt class="text-ink font-medium">Working on</dt>
        <dd>The lesson opened most recently, with its week and topic (knowledge component).</dd>
      </div>
      <div>
        <dt class="text-ink font-medium">First try</dt>
        <dd>Completed with no failed Submits, out of lessons with at least one Submit. Run doesn't count.</dd>
      </div>
      <div>
        <dt class="text-ink font-medium">Topic mastery</dt>
        <dd>BKT probability the student knows the topic, updated on each lesson's first Submit and shared by every lesson on that topic.</dd>
      </div>
      <div>
        <dt class="text-ink font-medium">Example mode</dt>
        <dd>Complete below 0.30, Faded up to 0.70, Erroneous above — the same cut-offs the tutor uses.</dd>
      </div>
      <div>
        <dt class="text-ink font-medium">Examples</dt>
        <dd>Given this round of the current lesson, out of 3. "Available" are earned by failed Submits but not yet asked for.</dd>
      </div>
    </dl>
  </section>
);

export default StudentsPage;

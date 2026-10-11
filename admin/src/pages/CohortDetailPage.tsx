import { A, useParams } from '@solidjs/router';
import { Component, createMemo, createSignal, For, Show } from 'solid-js';
import { createLiveQuery } from '../components/students/parts';
import { convex } from '../lib/convex';
import { parseRoster, type RosterRow } from '../lib/roster';
import { api } from '../lib/webConvexApi';

type Participant = {
  _id: string;
  studentId: string;
  group: 'experimental' | 'control';
  on_roster: boolean;
  metadata?: Record<string, string>;
  userId?: string;
  joined_at?: number;
  last_login_at?: number;
  login_count?: number;
  intake?: Record<string, string>;
};
type Roster = {
  cohort: { _id: string; name: string; code: string; open: boolean };
  participants: Participant[];
  questions: Array<{ id: string; label: string }>;
};

const when = (t?: number) => (t ? new Date(t).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '–');

const CohortDetailPage: Component = () => {
  const params = useParams();
  const roster = createLiveQuery<Roster | null>(api.cohorts.roster, () => ({ cohortId: params.id }));
  const [typed, setTyped] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const metadataKeys = createMemo(() => {
    const keys = new Set<string>();
    for (const p of roster.data()?.participants ?? []) for (const k of Object.keys(p.metadata ?? {})) keys.add(k);
    return [...keys];
  });

  const add = async (rows: RosterRow[]) => {
    if (!rows.length) {
      setError('No student IDs found.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await convex.mutation(api.cohorts.addParticipants, { cohortId: params.id as any, participants: rows });
      const parts = [`Added ${r.added} (${r.experimental} experimental, ${r.control} control).`];
      if (r.skipped.length) parts.push(`${r.skipped.length} already in this cohort: ${r.skipped.slice(0, 8).join(', ')}${r.skipped.length > 8 ? '…' : ''}.`);
      if (r.invalid.length) parts.push(`${r.invalid.length} not valid IDs: ${r.invalid.slice(0, 8).join(', ')}${r.invalid.length > 8 ? '…' : ''}.`);
      setMessage(parts.join(' '));
      setTyped('');
    } catch (err: any) {
      setError(err.message || 'Failed to add participants');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await add(parseRoster(await file.text()));
    input.value = '';
  };

  const toggleOpen = async () => {
    const c = roster.data()?.cohort;
    if (c) await convex.mutation(api.cohorts.setOpen, { cohortId: c._id as any, open: !c.open });
  };

  const remove = async (p: Participant) => {
    try {
      await convex.mutation(api.cohorts.removeParticipant, { participantId: p._id as any });
    } catch (err: any) {
      setError(err.message || 'Failed to remove');
    }
  };

  return (
    <div class="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-7">
      <A href="/cohorts" class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted hover:text-ink">← Cohorts</A>

      <Show when={roster.error()}>
        <div class="rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">{roster.error()!.message}</div>
      </Show>

      <Show when={roster.data()} fallback={<p class="text-sm text-muted">Loading…</p>}>
        {(data) => {
          const ps = () => data().participants;
          const count = (f: (p: Participant) => boolean) => ps().filter(f).length;
          return (
            <>
              <header class="border-b border-line pb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 class="font-display text-[30px] sm:text-[36px] leading-tight text-ink">{data().cohort.name}</h1>
                  <p class="mt-2 text-[15px] text-body">
                    {ps().length} participants · {count((p) => p.group === 'experimental')} experimental /{' '}
                    {count((p) => p.group === 'control')} control · {count((p) => !!p.userId)} signed in ·{' '}
                    {count((p) => !!p.intake)} survey done · {count((p) => !p.on_roster)} not on roster
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleOpen}
                  class={`rounded-md border px-4 py-2 text-sm transition-colors ${data().cohort.open ? 'border-garnet bg-garnet/10 text-garnet' : 'border-line text-body hover:text-ink'}`}
                  title="IDs on no roster join the open cohort. Only one cohort is open at a time."
                >
                  {data().cohort.open ? 'Open for IDs not on a roster ✓' : 'Make this the open cohort'}
                </button>
              </header>

              <section class="rounded-md border border-line bg-white p-6 space-y-4">
                <h2 class="font-display text-xl text-ink">Add participants</h2>
                <p class="text-sm text-body">
                  Type student IDs, one per line, or upload a CSV. The ID column is the one headed <code>id</code>,{' '}
                  <code>student id</code> or <code>student number</code> (or the first column); other columns are kept with
                  each student. New IDs get groups that keep the cohort balanced.
                </p>
                <textarea
                  rows={4}
                  value={typed()}
                  onInput={(e) => setTyped(e.currentTarget.value)}
                  placeholder={'s3912345\ns3912346'}
                  class="w-full rounded-md border border-line bg-white px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15"
                />
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy() || !typed().trim()}
                    onClick={() => add(parseRoster(typed()))}
                    class="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    Add IDs
                  </button>
                  <label class="cursor-pointer rounded-md border border-line px-5 py-2.5 text-sm text-body hover:text-ink">
                    Upload CSV
                    <input type="file" accept=".csv,text/csv,text/plain" class="hidden" onChange={onFile} disabled={busy()} />
                  </label>
                </div>
                <Show when={message()}>
                  <p class="text-sm text-ink">{message()}</p>
                </Show>
                <Show when={error()}>
                  <p class="text-sm text-garnet">{error()}</p>
                </Show>
              </section>

              <div class="overflow-x-auto rounded-md border border-line bg-white">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-line text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      <th class="px-4 py-3">Student ID</th>
                      <For each={metadataKeys()}>{(k) => <th class="px-4 py-3">{k}</th>}</For>
                      <th class="px-4 py-3">Group</th>
                      <th class="px-4 py-3">First sign-in</th>
                      <th class="px-4 py-3">Last sign-in</th>
                      <th class="px-4 py-3 text-right">Visits</th>
                      <For each={data().questions}>{(q) => <th class="px-4 py-3" title={q.label}>{q.id.replace(/_/g, ' ')}</th>}</For>
                      <th class="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    <For each={ps()} fallback={<tr><td class="px-4 py-10 text-center text-muted" colSpan={99}>No participants yet.</td></tr>}>
                      {(p) => (
                        <tr class="border-b border-line last:border-0">
                          <td class="px-4 py-2.5 font-mono">
                            {p.studentId}
                            <Show when={!p.on_roster}>
                              <span class="ml-2 rounded-sm bg-brass/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brass" title="Signed in with an ID that was on no roster">not on roster</span>
                            </Show>
                          </td>
                          <For each={metadataKeys()}>{(k) => <td class="px-4 py-2.5 text-body">{p.metadata?.[k] ?? ''}</td>}</For>
                          <td class="px-4 py-2.5">{p.group}</td>
                          <td class="px-4 py-2.5 tabular-nums text-body">{when(p.joined_at)}</td>
                          <td class="px-4 py-2.5 tabular-nums text-body">{when(p.last_login_at)}</td>
                          <td class="px-4 py-2.5 text-right tabular-nums">{p.login_count ?? 0}</td>
                          <For each={data().questions}>{(q) => <td class="px-4 py-2.5 text-body">{p.intake?.[q.id] ?? ''}</td>}</For>
                          <td class="px-4 py-2.5 text-right">
                            <Show when={!p.userId}>
                              <button type="button" onClick={() => remove(p)} class="text-xs text-muted hover:text-garnet">Remove</button>
                            </Show>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </Show>
    </div>
  );
};

export default CohortDetailPage;

import { A, useNavigate } from '@solidjs/router';
import { Component, createSignal, For, Show } from 'solid-js';
import { createLiveQuery } from '../components/students/parts';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';

type CohortRow = {
  _id: string;
  name: string;
  code: string;
  open: boolean;
  passcode?: string;
  created_at: number;
  participants: number;
  experimental: number;
  control: number;
  joined: number;
  intakeDone: number;
  notOnRoster: number;
};

const CohortsPage: Component = () => {
  const navigate = useNavigate();
  const cohorts = createLiveQuery<CohortRow[]>(api.cohorts.list, () => ({}));
  const [name, setName] = createSignal('');
  const [error, setError] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  const create = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) return;
    setCreating(true);
    setError('');
    try {
      const id = await convex.mutation(api.cohorts.create, { name: name().trim() });
      setName('');
      navigate(`/cohorts/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create the cohort');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div class="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-7">
      <header class="border-b border-line pb-7">
        <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Study sessions</p>
        <h1 class="mt-3 font-display text-[30px] sm:text-[36px] leading-tight tracking-[-0.01em] text-ink">Cohorts</h1>
        <p class="mt-2 max-w-2xl text-[15px] text-body">
          A cohort is one session's students, tracked by student ID. Add their IDs (typed or from a CSV) and each gets
          an experimental or control group straight away, keeping the cohort balanced. Students sign in with their ID
          only. An ID on no roster still gets in: it joins the cohort marked <em>open</em>, flagged for checking.
        </p>
      </header>

      <form onsubmit={create} class="rounded-md border border-line bg-white p-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label for="cohort-name" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            New cohort
          </label>
          <input
            id="cohort-name"
            type="text"
            placeholder="e.g. COSC3104 week 2, Tue 9am"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            class="mt-2 w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition"
          />
        </div>
        <button
          type="submit"
          disabled={creating() || !name().trim()}
          class="inline-flex items-center justify-center rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          {creating() ? 'Creating…' : 'Create cohort'}
        </button>
      </form>
      <Show when={error()}>
        <p class="text-sm text-garnet">{error()}</p>
      </Show>

      <Show when={cohorts.error()}>
        <div class="rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">
          Failed to load cohorts: {cohorts.error()!.message}
        </div>
      </Show>

      <Show
        when={cohorts.data()}
        fallback={<div class="rounded-md border border-line bg-white px-6 py-16 text-center text-sm text-muted">Loading cohorts…</div>}
      >
        <Show
          when={cohorts.data()!.length}
          fallback={<div class="rounded-md border border-line bg-white px-6 py-16 text-center text-sm text-muted">No cohorts yet.</div>}
        >
          <div class="overflow-x-auto rounded-md border border-line bg-white">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-line text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th class="px-4 py-3">Cohort</th>
                  <th class="px-4 py-3 text-right">Participants</th>
                  <th class="px-4 py-3 text-right">Experimental / control</th>
                  <th class="px-4 py-3 text-right">Signed in</th>
                  <th class="px-4 py-3 text-right">Survey done</th>
                  <th class="px-4 py-3 text-right">Not on roster</th>
                  <th class="px-4 py-3">Passcode</th>
                  <th class="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                <For each={cohorts.data()}>
                  {(c) => (
                    <tr class="border-b border-line last:border-0">
                      <td class="px-4 py-3">
                        <A href={`/cohorts/${c._id}`} class="font-medium text-ink hover:text-garnet">{c.name}</A>
                        <div class="font-mono text-[11px] text-muted">{new Date(c.created_at).toLocaleDateString()}</div>
                      </td>
                      <td class="px-4 py-3 text-right tabular-nums">{c.participants}</td>
                      <td class="px-4 py-3 text-right tabular-nums">{c.experimental} / {c.control}</td>
                      <td class="px-4 py-3 text-right tabular-nums">{c.joined}</td>
                      <td class="px-4 py-3 text-right tabular-nums">{c.intakeDone}</td>
                      <td class="px-4 py-3 text-right tabular-nums">{c.notOnRoster || '–'}</td>
                      <td class="px-4 py-3 font-mono text-[12px] text-body">{c.passcode || '–'}</td>
                      <td class="px-4 py-3">
                        <Show when={c.open} fallback={<span class="text-muted">–</span>}>
                          <span class="rounded-sm bg-garnet/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-garnet">open</span>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default CohortsPage;

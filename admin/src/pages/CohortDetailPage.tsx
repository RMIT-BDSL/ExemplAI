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
  session_visits?: number;
  practice_visits?: number;
  consented?: boolean;
  consent_at?: number;
  consent_version?: string;
  pre_survey?: Record<string, string | string[]>;
  pre_survey_at?: number;
  exercises_started_at?: number;
  exercises_finished_at?: number;
  post_survey?: Record<string, string | string[]>;
  post_survey_at?: number;
  /** Tutor tokens and cost (USD), summed over the student's tutor replies, by phase. */
  usage: Record<'session' | 'practice', UsageSums> | null;
  check_order?: 'AB' | 'BA';
  pre_check_started_at?: number;
  post_check_started_at?: number;
  /** Quick-check scores (web/convex/quickChecks.ts checkScores); null = not started. */
  checks: Record<'pre' | 'post', CheckScore | null>;
  /** When the exercises started and end (web/convex/sessionFlow.ts timelineOf). */
  timeline: { exercisesStartAt: number | null; exercisesEndsAt: number | null };
};
type CheckScore = {
  form: 'A' | 'B';
  score: number;
  problems: Array<{ problem: string; passed: number; total: number; answered: boolean; auto: boolean }>;
};
type UsageSums = { replies: number; input_tokens: number; output_tokens: number; cost_usd: number };
type Survey = Array<{ title: string; questions: Array<{ id: string; label: string }> }>;
type Roster = {
  cohort: {
    _id: string;
    name: string;
    code: string;
    open: boolean;
    passcode?: string;
    session_week: number;
    exercise_minutes: number;
    check_minutes: number;
    exercises_end_at?: number;
  };
  participants: Participant[];
  preSurvey: Survey;
  postSurvey: Survey;
};

const when = (t?: number) => (t ? new Date(t).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '–');
const time = (t?: number) => (t ? new Date(t).toLocaleTimeString([], { timeStyle: 'short' }) : '–');

/**
 * Roughly where a student is in the session flow, from their record. The app
 * also moves students on when clocks run out (web/convex/sessionFlow.ts), so
 * this can lag by a step until they act.
 */
function stage(p: Participant, ended: boolean): string {
  if (!p.userId) return 'Not signed in';
  if (p.consented === undefined) return 'Consent';
  if (p.consented && !p.pre_survey) return 'Pre-survey';
  if (p.post_survey) return 'Done';
  if (!p.consented) return 'Declined';
  if (p.post_check_started_at) return 'Post check / post-survey';
  if (p.exercises_finished_at || ended) return 'Post check';
  if (p.exercises_started_at || p.checks.pre) return 'Pre check / exercises';
  return 'Pre check';
}

const checkCell = (c: CheckScore | null) =>
  c ? `${c.score} (${c.form}${c.problems.some((x) => x.auto) ? ', auto' : ''})` : '–';

/** CSV of every participant: record fields, then pre_/post_ survey answers by question id. */
function toCsv(data: Roster): string {
  const ids = (survey: Survey) => survey.flatMap((s) => s.questions.map((q) => q.id));
  const pre = ids(data.preSurvey);
  const post = ids(data.postSurvey);
  const metaKeys = [...new Set(data.participants.flatMap((p) => Object.keys(p.metadata ?? {})))];
  const iso = (t?: number) => (t ? new Date(t).toISOString() : '');
  const answer = (v?: string | string[]) => (Array.isArray(v) ? v.join('; ') : (v ?? ''));
  const header = [
    'student_id', 'cohort', 'group', 'on_roster', ...metaKeys.map((k) => `meta_${k}`),
    'first_sign_in', 'last_sign_in', 'session_visits', 'practice_visits',
    'consented', 'consent_at', 'consent_version', 'pre_survey_at', 'exercises_started_at',
    'exercises_ended_at', 'finished_early_at', 'post_survey_at',
    ...(['session', 'practice'] as const).flatMap((ph) =>
      ['replies', 'input_tokens', 'output_tokens', 'cost_usd'].map((f) => `${ph}_tutor_${f}`),
    ),
    'check_order',
    ...(['pre', 'post'] as const).flatMap((ph) => [
      `${ph}_check_form`, `${ph}_check_score`,
      ...[1, 2].flatMap((n) => [`${ph}_check_p${n}_passed`, `${ph}_check_p${n}_total`, `${ph}_check_p${n}_auto`]),
    ]),
    ...pre.map((id) => `pre.${id}`), ...post.map((id) => `post.${id}`),
  ];
  const rows = data.participants.map((p) => [
    p.studentId, data.cohort.code, p.group, String(p.on_roster), ...metaKeys.map((k) => p.metadata?.[k] ?? ''),
    iso(p.joined_at), iso(p.last_login_at), String(p.session_visits ?? 0), String(p.practice_visits ?? 0),
    p.consented === undefined ? '' : String(p.consented), iso(p.consent_at), p.consent_version ?? '',
    iso(p.pre_survey_at), iso(p.timeline.exercisesStartAt ?? undefined),
    // The end only once it has passed (a student still working has a future end).
    iso(p.timeline.exercisesEndsAt !== null && p.timeline.exercisesEndsAt <= Date.now() ? p.timeline.exercisesEndsAt : undefined),
    iso(p.exercises_finished_at), iso(p.post_survey_at),
    ...(['session', 'practice'] as const).flatMap((ph) => {
      const u = p.usage?.[ph];
      return u ? [String(u.replies), String(u.input_tokens), String(u.output_tokens), u.cost_usd.toFixed(6)] : ['', '', '', ''];
    }),
    p.check_order ?? '',
    ...(['pre', 'post'] as const).flatMap((ph) => {
      const c = p.checks[ph];
      if (!c) return ['', '', '', '', '', '', '', ''];
      return [
        c.form, String(c.score),
        ...[0, 1].flatMap((i) => {
          const x = c.problems[i];
          return x ? [x.answered ? String(x.passed) : '', String(x.total), String(x.auto)] : ['', '', ''];
        }),
      ];
    }),
    ...pre.map((id) => answer(p.pre_survey?.[id])), ...post.map((id) => answer(p.post_survey?.[id])),
  ]);
  const cell = (raw: string) => {
    // Text starting like a formula (a survey answer, a roster column) would run
    // as one in Excel; a leading ' keeps it text. Plain numbers are left alone.
    const v = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

const CohortDetailPage: Component = () => {
  const params = useParams();
  const roster = createLiveQuery<Roster | null>(api.cohorts.roster, () => ({ cohortId: params.id }));
  const [typed, setTyped] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [passcode, setPasscode] = createSignal<string | null>(null); // null: not being edited
  const [week, setWeek] = createSignal<string | null>(null);
  const [minutes, setMinutes] = createSignal<string | null>(null);
  const [checkMinutes, setCheckMinutes] = createSignal<string | null>(null);
  const [confirmEnd, setConfirmEnd] = createSignal(false);

  const saveSession = async () => {
    const c = roster.data()?.cohort;
    if (!c) return;
    try {
      await convex.mutation(api.cohorts.setSession, {
        cohortId: c._id as any,
        session_week: Number(week() ?? c.session_week),
        exercise_minutes: Number(minutes() ?? c.exercise_minutes),
        check_minutes: Number(checkMinutes() ?? c.check_minutes),
      });
      setWeek(null);
      setMinutes(null);
      setCheckMinutes(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save the session settings');
    }
  };

  const setEnded = async (ended: boolean) => {
    const c = roster.data()?.cohort;
    if (!c) return;
    setConfirmEnd(false);
    try {
      await convex.mutation(api.cohorts.setExercisesEnded, { cohortId: c._id as any, ended });
    } catch (err: any) {
      setError(err.message || 'Failed to change the session');
    }
  };

  const reset = async (p: Participant) => {
    try {
      await convex.mutation(api.cohorts.resetSession, { participantId: p._id as any });
    } catch (err: any) {
      setError(err.message || 'Failed to reset');
    }
  };

  const download = () => {
    const data = roster.data();
    if (!data) return;
    const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.cohort.code}-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    // Some browsers read the link after click() returns.
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const savePasscode = async (value: string) => {
    const c = roster.data()?.cohort;
    if (!c) return;
    try {
      await convex.mutation(api.cohorts.setPasscode, { cohortId: c._id as any, passcode: value });
      setPasscode(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save the passcode');
    }
  };

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
    if (!c) return;
    try {
      await convex.mutation(api.cohorts.setOpen, { cohortId: c._id as any, open: !c.open });
    } catch (err: any) {
      setError(err.message || 'Failed to change the open cohort');
    }
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
                    {count((p) => p.consented === true)} consented · {count((p) => p.consented === false)} declined ·{' '}
                    {count((p) => !!p.pre_survey)} pre-survey · {count((p) => !!p.post_survey)} post-survey ·{' '}
                    {count((p) => !p.on_roster)} not on roster
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

              <section class="rounded-md border border-line bg-white p-6 space-y-3">
                <h2 class="font-display text-xl text-ink">Class passcode</h2>
                <p class="text-sm text-body">
                  If set, students must enter it with their ID to sign in (case and spaces don't matter), and their visits
                  count as the experimental <strong>session</strong>. Clear it after the session: students then return
                  with their ID alone for <strong>open practice</strong>, keeping their group, and that activity is
                  tagged as practice.
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={passcode() ?? data().cohort.passcode ?? ''}
                    onInput={(e) => setPasscode(e.currentTarget.value)}
                    placeholder="No passcode: ID only"
                    class="w-56 rounded-md border border-line bg-white px-3.5 py-2 font-mono text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15"
                  />
                  <button
                    type="button"
                    disabled={passcode() === null}
                    onClick={() => savePasscode(passcode() ?? '')}
                    class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <Show when={data().cohort.passcode}>
                    <button type="button" onClick={() => savePasscode('')} class="text-sm text-muted hover:text-garnet">
                      Clear
                    </button>
                  </Show>
                </div>
              </section>

              <section class="rounded-md border border-line bg-white p-6 space-y-4">
                <h2 class="font-display text-xl text-ink">Session</h2>
                <p class="text-sm text-body">
                  While the cohort has a passcode, students go through consent, the pre-survey, a quick check (two
                  problems, tutor off), the exercises, another quick check and the post-survey, in order. They see only
                  the session week's lessons. Each student's exercise time starts when they finish the first quick
                  check; when it runs out (or you end the exercises for everyone) they move on to the second. Half of
                  each group takes form A first and half form B. A week without quick-check problems skips the checks.
                </p>
                <div class="flex flex-wrap items-end gap-4">
                  <label class="text-sm text-body">
                    <span class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Week</span>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={week() ?? data().cohort.session_week}
                      onInput={(e) => setWeek(e.currentTarget.value)}
                      class="mt-1 w-20 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-garnet"
                    />
                  </label>
                  <label class="text-sm text-body">
                    <span class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Exercise minutes</span>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={minutes() ?? data().cohort.exercise_minutes}
                      onInput={(e) => setMinutes(e.currentTarget.value)}
                      class="mt-1 w-24 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-garnet"
                    />
                  </label>
                  <label class="text-sm text-body">
                    <span class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Quick-check minutes</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={checkMinutes() ?? data().cohort.check_minutes}
                      onInput={(e) => setCheckMinutes(e.currentTarget.value)}
                      class="mt-1 w-24 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-garnet"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={week() === null && minutes() === null && checkMinutes() === null}
                    onClick={saveSession}
                    class="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <Show
                    when={data().cohort.exercises_end_at}
                    fallback={
                      <Show
                        when={confirmEnd()}
                        fallback={
                          <button
                            type="button"
                            onClick={() => setConfirmEnd(true)}
                            class="rounded-md border border-garnet px-4 py-2 text-sm text-garnet hover:bg-garnet/10"
                          >
                            End exercises for everyone now
                          </button>
                        }
                      >
                        <span class="text-sm text-ink">Send every student in this cohort to the post-survey now?</span>
                        <button type="button" onClick={() => setEnded(true)} class="rounded-md bg-garnet px-4 py-2 text-sm font-medium text-white">
                          Yes, end now
                        </button>
                        <button type="button" onClick={() => setConfirmEnd(false)} class="text-sm text-muted hover:text-ink">
                          Cancel
                        </button>
                      </Show>
                    }
                  >
                    <span class="text-sm text-garnet">Exercises ended for everyone at {time(data().cohort.exercises_end_at)}.</span>
                    <button type="button" onClick={() => setEnded(false)} class="text-sm text-muted hover:text-ink">
                      Undo
                    </button>
                  </Show>
                </div>
              </section>

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

              <div class="flex justify-end">
                <button
                  type="button"
                  onClick={download}
                  class="rounded-md border border-line px-4 py-2 text-sm text-body hover:text-ink"
                  title="One row per student: their record, then pre.* and post.* survey answers"
                >
                  Download responses (CSV)
                </button>
              </div>
              <div class="overflow-x-auto rounded-md border border-line bg-white">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-line text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      <th class="px-4 py-3">Student ID</th>
                      <For each={metadataKeys()}>{(k) => <th class="px-4 py-3">{k}</th>}</For>
                      <th class="px-4 py-3">Group</th>
                      <th class="px-4 py-3">First sign-in</th>
                      <th class="px-4 py-3">Last sign-in</th>
                      <th class="px-4 py-3 text-right" title="Visits while the cohort had a class passcode">Session visits</th>
                      <th class="px-4 py-3 text-right" title="Visits after the passcode was cleared">Practice visits</th>
                      <th class="px-4 py-3">Stage</th>
                      <th class="px-4 py-3">Consent</th>
                      <th class="px-4 py-3">Pre-survey</th>
                      <th class="px-4 py-3" title="Quick check before the exercises: score 0–100 (form)">Pre check</th>
                      <th class="px-4 py-3" title="Started (after the pre check) and finished">Exercises</th>
                      <th class="px-4 py-3" title="Quick check after the exercises: score 0–100 (form)">Post check</th>
                      <th class="px-4 py-3">Post-survey</th>
                      <th class="px-4 py-3 text-right" title="Tutor replies, tokens (in + out) and cost during the session">
                        Tutor (session)
                      </th>
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
                          <td class="px-4 py-2.5 text-right tabular-nums">{p.session_visits ?? 0}</td>
                          <td class="px-4 py-2.5 text-right tabular-nums">{p.practice_visits ?? 0}</td>
                          <td class="px-4 py-2.5 whitespace-nowrap">{stage(p, !!data().cohort.exercises_end_at)}</td>
                          <td class="px-4 py-2.5 whitespace-nowrap text-body">
                            {p.consented === undefined ? '–' : p.consented ? `Agreed ${time(p.consent_at)}` : 'Declined'}
                          </td>
                          <td class="px-4 py-2.5 tabular-nums text-body">{time(p.pre_survey_at)}</td>
                          <td class="px-4 py-2.5 whitespace-nowrap tabular-nums text-body">{checkCell(p.checks.pre)}</td>
                          <td class="px-4 py-2.5 whitespace-nowrap tabular-nums text-body">
                            {time(p.timeline.exercisesStartAt ?? undefined)} →{' '}
                            {time(p.timeline.exercisesEndsAt ?? undefined)}
                          </td>
                          <td class="px-4 py-2.5 whitespace-nowrap tabular-nums text-body">{checkCell(p.checks.post)}</td>
                          <td class="px-4 py-2.5 tabular-nums text-body">{time(p.post_survey_at)}</td>
                          <td class="px-4 py-2.5 whitespace-nowrap text-right tabular-nums text-body">
                            {p.usage?.session.replies
                              ? `${p.usage.session.replies} · ${(p.usage.session.input_tokens + p.usage.session.output_tokens).toLocaleString()} tok · $${p.usage.session.cost_usd.toFixed(4)}`
                              : '–'}
                          </td>
                          <td class="px-4 py-2.5 text-right whitespace-nowrap">
                            <Show when={!p.userId}>
                              <button type="button" onClick={() => remove(p)} class="text-xs text-muted hover:text-garnet">Remove</button>
                            </Show>
                            <Show when={p.consented !== undefined}>
                              <button
                                type="button"
                                onClick={() => reset(p)}
                                class="text-xs text-muted hover:text-garnet"
                                title="Testing: clear consent, surveys and exercise times so this student starts the session again"
                              >
                                Reset
                              </button>
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

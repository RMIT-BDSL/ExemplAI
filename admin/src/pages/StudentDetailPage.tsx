import { Component, For, JSX, Match, Show, Switch } from 'solid-js';
import { A, useParams, useSearchParams } from '@solidjs/router';
import type { GenericId as Id } from 'convex/values';
import { api } from '../lib/webConvexApi';
import type { ActivityItem, LessonSnapshot, ReplyCounts, StudentDetail, TutorGroup } from '../components/students/types';
import {
  BandChart,
  LiveDot,
  MasteryRule,
  ModeTag,
  ReplyMixPanel,
  StatusText,
  TutorTag,
  ago,
  createLiveQuery,
  displayName,
  fullDate,
  pct,
  servingMode,
  servingNow,
} from '../components/students/parts';

type View = 'topic' | 'week' | 'lesson';
const VIEWS: { value: View; label: string; hint: string }[] = [
  { value: 'topic', label: 'By topic', hint: 'Mastery is tracked per topic' },
  { value: 'week', label: 'By week', hint: 'Average mastery of the topics behind each week' },
  { value: 'lesson', label: 'By lesson', hint: "Each lesson shows its topic's mastery" },
];

const StudentDetailPage: Component = () => {
  const params = useParams();
  const [search] = useSearchParams<{ by?: View }>();
  const view = (): View => (VIEWS.some((v) => v.value === search.by) ? (search.by as View) : 'topic');
  const { data, error } = createLiveQuery<StudentDetail | null>(api.students.getStudent, () => ({
    userId: params.id as Id<'users'>,
  }));

  return (
    <div class="max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-8">
      <nav aria-label="Breadcrumb" class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted min-w-0">
          <A href="/students" class="hover:text-ink hover:underline">Students</A>
          <span aria-hidden="true">/</span>
          <span class="text-ink truncate">{data() ? displayName(data()!.student) : '…'}</span>
        </div>
        <LiveDot ok={!error()} />
      </nav>

      <Show when={error()}>
        <div role="alert" class="rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">
          Couldn't load this student: {error()!.message}
        </div>
      </Show>

      <Show when={data() !== null} fallback={<NotFound />}>
        <Show when={data()} fallback={<Skeleton />}>
          {(d) => (
            <>
              <header class="border-b border-line pb-7">
                <h1 class="font-display text-[30px] sm:text-[38px] leading-tight tracking-[-0.01em] text-ink">
                  {displayName(d().student)}
                </h1>
                <p class="mt-2 text-sm text-body flex flex-wrap gap-x-4 gap-y-1">
                  <span class="font-mono text-[12px]">{d().student.email}</span>
                  <span>Joined {fullDate(d().student.joinedAt)}</span>
                  <Show when={d().student.invitationCode}>
                    <span>Code <span class="font-mono text-[12px] text-ink">{d().student.invitationCode}</span></span>
                  </Show>
                </p>
              </header>

              <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <NowPanel current={d().current} tutor={d().totals.tutor} replies={d().totals.replies} />
                <Totals d={d()} />
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <section class="lg:col-span-2 rounded-md border border-line bg-white overflow-hidden">
                  <div class="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line">
                    <h2 class="font-display text-lg text-ink">Progress</h2>
                    <nav aria-label="Group progress" class="inline-flex rounded-md border border-line p-0.5 self-start">
                      <For each={VIEWS}>
                        {(v) => (
                          <A
                            href={`?by=${v.value}`}
                            title={v.hint}
                            aria-current={view() === v.value ? 'page' : undefined}
                            class="px-3 py-1.5 text-sm rounded-[5px] transition-colors"
                            classList={{ 'bg-ink text-paper': view() === v.value, 'text-body hover:text-ink': view() !== v.value }}
                          >
                            {v.label}
                          </A>
                        )}
                      </For>
                    </nav>
                  </div>
                  <div class="overflow-x-auto">
                    <Switch>
                      <Match when={view() === 'topic'}><TopicTable d={d()} /></Match>
                      <Match when={view() === 'week'}><WeekTable d={d()} /></Match>
                      <Match when={view() === 'lesson'}><LessonTable d={d()} /></Match>
                    </Switch>
                  </div>
                </section>
                <div class="space-y-5">
                  <BandChart bands={d().firstTryByBand} scope="this student" />
                  <ReplyMixPanel replies={d().totals.replies} scope="this student" />
                  <Activity items={d().activity} />
                </div>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

// ── Now panel (the student's current lesson at a glance) ───────────────

const NowPanel: Component<{ current: LessonSnapshot | null; tutor: TutorGroup | null; replies: ReplyCounts }> = (props) => (
  <section class="lg:col-span-3 rounded-md border border-line bg-white p-5">
    <h2 class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Working on now</h2>
    <Show when={props.current} fallback={<p class="mt-4 text-sm text-muted">This student hasn't opened a lesson yet.</p>}>
      {(c) => {
        const serving = () => servingNow(c().mastery, c().lastReply, props.tutor);
        return (
        <dl class="mt-3 grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-3 text-sm">
          <Row label="Lesson">
            <span class="font-mono text-ink">{c().name}</span>
            <span class="ml-2 text-muted">week {c().week}</span>
          </Row>
          <Row label="Topic">
            <span class="font-mono text-ink">{c().kc ?? '—'}</span>
            <Show when={c().topic}><span class="ml-2 text-muted">{c().topic}</span></Show>
          </Row>
          <Row label="Mastery">
            <div class="flex items-center gap-3">
              <div class="flex-1 max-w-64"><MasteryRule value={c().mastery} serving={serving()} replies={props.replies} /></div>
              <Show
                when={servingMode(serving())}
                fallback={<span class="text-xs text-muted">No tutor reply yet; hover the bar for what's next</span>}
              >
                {(mode) => (
                  <>
                    <span class="text-muted" aria-hidden="true">→</span>
                    <ModeTag mode={mode()} />
                  </>
                )}
              </Show>
            </div>
          </Row>
          <Row label="Status">
            <StatusText status={c().status} />
            <Show when={c().failedSubmits > 0}>
              <span class="ml-2 text-muted">· {c().failedSubmits} failed Submit{c().failedSubmits === 1 ? '' : 's'}</span>
            </Show>
          </Row>
          <Row label="Tutor">
            <TutorTag tutor={props.tutor} replies={props.replies} />
          </Row>
          <Row label="Examples">
            <Show
              when={serving().kind !== 'control'}
              fallback={<span class="text-muted">None: the normal tutor doesn't give worked examples</span>}
            >
              <span class="font-mono tabular-nums">{c().examples.used} of {c().examples.cap} used · {c().examples.remaining} available</span>
            </Show>
          </Row>
          <Row label="Last reply">
            <Show when={c().lastReply} fallback={<span class="text-muted">No tutor replies on this lesson</span>}>
              {(r) => (
                <span class="inline-flex items-center gap-2 flex-wrap">
                  <ModeTag mode={r().mode} />
                  <Show when={r().responseType}><span class="font-mono text-[12px] text-body">{r().responseType}</span></Show>
                  <span class="text-muted" title={fullDate(r().at)}>{ago(r().at)}</span>
                </span>
              )}
            </Show>
          </Row>
        </dl>
        );
      }}
    </Show>
  </section>
);

const Row: Component<{ label: string; children: JSX.Element }> = (props) => (
  <>
    <dt class="text-muted">{props.label}</dt>
    <dd class="min-w-0 text-body">{props.children}</dd>
  </>
);

const Totals: Component<{ d: StudentDetail }> = (props) => {
  const t = () => props.d.totals;
  const items = () => [
    { label: 'First-try pass rate', value: pct(t().firstTryRate), note: `${t().firstTry} of ${t().submitted} submitted` },
    { label: 'Completed', value: `${t().completed}`, note: `of ${t().lessons} lessons · ${t().started} started` },
    { label: 'Overall mastery', value: t().overallMastery == null ? '—' : t().overallMastery!.toFixed(2), note: `average of ${t().topicsTracked} topic${t().topicsTracked === 1 ? '' : 's'} with a Submit` },
    { label: 'Topics mastered', value: `${t().topicsMastered}`, note: `examples given: ${t().examplesGiven}` },
  ];
  return (
    <section aria-label="Totals" class="lg:col-span-2 grid grid-cols-2 border border-line rounded-md bg-white overflow-hidden">
      <For each={items()}>
        {(it, i) => (
          <div class="px-5 py-5 border-line" classList={{ 'border-r': i() % 2 === 0, 'border-b': i() < 2 }}>
            <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{it.label}</p>
            <p class="mt-1.5 font-display text-[30px] leading-none tabular-nums text-ink">{it.value}</p>
            <p class="mt-2 text-xs text-muted">{it.note}</p>
          </div>
        )}
      </For>
    </section>
  );
};

// ── Progress tables ────────────────────────────────────────────────────

const th = 'px-4 py-2.5 font-normal text-left';
const Head: Component<{ cols: string[] }> = (props) => (
  <thead>
    <tr class="border-b border-line font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
      <For each={props.cols}>{(c) => <th scope="col" class={th}>{c}</th>}</For>
    </tr>
  </thead>
);
const Empty: Component<{ cols: number; text: string }> = (props) => (
  <tr><td colspan={props.cols} class="px-4 py-10 text-center text-sm text-muted">{props.text}</td></tr>
);
const ratio = (a: number, b: number) => (b ? `${a} of ${b}` : '—');

const TopicTable: Component<{ d: StudentDetail }> = (props) => (
  <table class="w-full text-sm">
    <caption class="sr-only">Mastery by topic, lowest first</caption>
    <Head cols={['Topic', 'Mastery', 'Mode', 'Lessons done', 'First try', 'Updated']} />
    <tbody class="divide-y divide-line/70">
      <Show when={props.d.topics.length} fallback={<Empty cols={6} text="No topics yet. Mastery starts with the first Submit on a lesson." />}>
        <For each={props.d.topics}>
          {(t) => (
            <tr>
              <td class="px-4 py-3">
                <p class="font-mono text-[12px] text-ink">{t.kc}</p>
                <Show when={t.topic}><p class="text-[11px] text-muted">{t.topic}</p></Show>
              </td>
              <td class="px-4 py-3 min-w-40"><MasteryRule value={t.mastery} /></td>
              <td class="px-4 py-3">
                <Show when={t.mastered} fallback={<ModeTag mode={t.mode} />}>
                  <span class="text-ivy text-[12px] font-medium" title={t.masteredAt ? `Mastered ${fullDate(t.masteredAt)}` : undefined}>✓ Mastered</span>
                </Show>
              </td>
              <td class="px-4 py-3 font-mono text-[12px] tabular-nums">{ratio(t.completed, t.lessons)}</td>
              <td class="px-4 py-3 font-mono text-[12px] tabular-nums">{ratio(t.firstTry, t.submitted)}</td>
              <td class="px-4 py-3 text-body whitespace-nowrap" title={fullDate(t.updatedAt)}>{ago(t.updatedAt)}</td>
            </tr>
          )}
        </For>
      </Show>
    </tbody>
  </table>
);

const WeekTable: Component<{ d: StudentDetail }> = (props) => (
  <table class="w-full text-sm">
    <caption class="sr-only">Progress by week</caption>
    <Head cols={['Week', 'Topics', 'Avg mastery', 'Completed', 'First try']} />
    <tbody class="divide-y divide-line/70">
      <Show when={props.d.weeks.length} fallback={<Empty cols={5} text="No lessons in the course yet." />}>
        <For each={props.d.weeks}>
          {(w) => (
            <tr classList={{ 'text-muted': w.started === 0 }}>
              <td class="px-4 py-3">
                <span class="grid place-items-center w-8 h-8 rounded bg-ink text-paper font-mono text-xs font-semibold">W{w.week}</span>
              </td>
              <td class="px-4 py-3 font-mono text-[11px] text-body">{w.topics.join(', ') || '—'}</td>
              <td class="px-4 py-3 min-w-40"><MasteryRule value={w.mastery} /></td>
              <td class="px-4 py-3 font-mono text-[12px] tabular-nums">{ratio(w.completed, w.lessons)}</td>
              <td class="px-4 py-3 font-mono text-[12px] tabular-nums">{ratio(w.firstTry, w.submitted)}</td>
            </tr>
          )}
        </For>
      </Show>
    </tbody>
  </table>
);

const LessonTable: Component<{ d: StudentDetail }> = (props) => (
  <table class="w-full text-sm">
    <caption class="sr-only">Progress by lesson</caption>
    <Head cols={['Lesson', 'Status', 'Failed Submits', 'Examples', 'Topic mastery', 'Last active']} />
    <tbody class="divide-y divide-line/70">
      <Show when={props.d.lessons.length} fallback={<Empty cols={6} text="No lessons in the course yet." />}>
        <For each={props.d.lessons}>
          {(l) => (
            <tr classList={{ 'text-muted': l.status === 'pending' }}>
              <td class="px-4 py-3">
                <p class="text-ink"><span class="font-mono text-[11px] text-muted mr-1.5">W{l.week}</span>{l.name}</p>
                <p class="font-mono text-[11px] text-muted">{l.kc ?? 'no topic'}</p>
              </td>
              <td class="px-4 py-3">
                <StatusText status={l.status} />
                <Show when={l.firstTry}><p class="text-[11px] text-ivy">first try</p></Show>
              </td>
              <td class="px-4 py-3 font-mono text-[12px] tabular-nums">{l.submitted ? l.failedSubmits : '—'}</td>
              <td class="px-4 py-3 font-mono text-[12px] tabular-nums">{l.examplesGiven || '—'}</td>
              <td class="px-4 py-3 min-w-36"><MasteryRule value={l.mastery} compact /></td>
              <td class="px-4 py-3 whitespace-nowrap" title={l.lastActivityAt ? fullDate(l.lastActivityAt) : undefined}>{l.lastActivityAt ? ago(l.lastActivityAt) : '—'}</td>
            </tr>
          )}
        </For>
      </Show>
    </tbody>
  </table>
);

// ── Recent activity ────────────────────────────────────────────────────

const KIND_LABEL: Record<ActivityItem['kind'], string> = {
  started: 'Opened',
  submitted: 'Submitted',
  completed: 'Completed',
  mastered: 'Mastered topic',
  help: 'Asked for help',
  example: 'Got an example',
};

const KIND_DOT: Record<ActivityItem['kind'], string> = {
  started: 'bg-line border border-muted',
  submitted: 'bg-brass',
  completed: 'bg-ivy',
  mastered: 'bg-garnet',
  help: 'bg-ink/40',
  example: 'bg-ink',
};

const Activity: Component<{ items: ActivityItem[] }> = (props) => (
  <section class="rounded-md border border-line bg-white p-5">
    <h2 class="font-display text-lg text-ink">Recent activity</h2>
    <Show when={props.items.length} fallback={<p class="mt-3 text-sm text-muted">Nothing yet.</p>}>
      <ol class="mt-4 relative border-l border-line ml-1 space-y-4">
        <For each={props.items}>
          {(a) => (
            <li class="pl-4 relative">
              <span aria-hidden="true" class={`absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full ${KIND_DOT[a.kind]}`} />
              <p class="text-sm text-ink">
                {KIND_LABEL[a.kind]}
                <Show when={a.lessonName}> <span class="font-mono text-[12px]">{a.lessonName}</span></Show>
                <Show when={a.kind === 'mastered'}> <span class="font-mono text-[12px]">{a.detail}</span></Show>
              </p>
              <p class="text-[11px] text-muted">
                <time datetime={new Date(a.at).toISOString()} title={fullDate(a.at)}>{ago(a.at)}</time>
                <Show when={a.detail && a.kind !== 'mastered'}> · {a.kind === 'example' ? `${a.detail} example` : a.detail}</Show>
              </p>
            </li>
          )}
        </For>
      </ol>
    </Show>
  </section>
);

const Skeleton = () => (
  <div class="space-y-5" aria-busy="true" aria-label="Loading student">
    <div class="h-12 w-72 rounded bg-line/70 animate-pulse motion-reduce:animate-none" />
    <div class="h-56 rounded-md border border-line bg-white/50 animate-pulse motion-reduce:animate-none" />
    <div class="h-72 rounded-md border border-line bg-white/50 animate-pulse motion-reduce:animate-none" />
  </div>
);

const NotFound = () => (
  <div class="rounded-md border border-line bg-white px-6 py-12 text-center">
    <p class="font-display text-xl text-ink">Student not found</p>
    <p class="mt-1 text-sm text-body">They may have been removed, or this account is staff.</p>
    <A href="/students" class="mt-4 inline-block text-sm text-garnet hover:underline">Back to students</A>
  </div>
);

export default StudentDetailPage;

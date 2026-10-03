import { Component, For, JSX, Show, createEffect, createSignal, createUniqueId, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { FunctionReference } from 'convex/server';
import { convex } from '../../lib/convex';
import type { BandStat, ExampleMode, LessonStatus, ReplyCounts, ReplyKind, ReplyMode, TutorGroup } from './types';

/**
 * Subscribes to a Convex query so the page updates as students work.
 * `data` is undefined until the first result arrives.
 */
export function createLiveQuery<T>(
  query: FunctionReference<'query', 'public', any, any>,
  args: () => Record<string, unknown>,
) {
  const [data, setData] = createSignal<T | undefined>(undefined);
  const [error, setError] = createSignal<Error | null>(null);
  // Re-subscribes when args change (e.g. moving between students).
  createEffect(() => {
    setData(undefined);
    const unsubscribe = convex.onUpdate(
      query,
      args(),
      (result: T) => {
        setError(null);
        setData(() => result);
      },
      (err: Error) => setError(err),
    );
    onCleanup(() => unsubscribe());
  });
  return { data, error };
}

type PageResult<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
  splitCursor?: string | null;
  pageStatus?: 'SplitRecommended' | 'SplitRequired' | null;
};
type PageSpec = { cursor: string | null; endCursor?: string };
const specKey = (s: PageSpec) => `${s.cursor ?? ''}|${s.endCursor ?? ''}`;

/**
 * Live, paginated Convex query, like convex/react's usePaginatedQuery. Each
 * loaded page is its own subscription; once a page first loads it is pinned to
 * the cursor range it covered, so rows moving between pages (a student becoming
 * active) neither repeat nor vanish. A page the server says has grown too big
 * is split in two.
 */
export function createPaginatedLiveQuery<T>(
  query: FunctionReference<'query', 'public', any, any>,
  numItems: number,
) {
  const [specs, setSpecs] = createSignal<PageSpec[]>([{ cursor: null }]);
  const [results, setResults] = createSignal<Record<string, PageResult<T>>>({});
  const [error, setError] = createSignal<Error | null>(null);
  const subs = new Map<string, () => void>();

  const replaceSpec = (old: PageSpec, next: PageSpec[], carry?: PageResult<T>) => {
    if (carry) setResults((r) => ({ ...r, [specKey(next[0])]: carry }));
    setSpecs((list) => list.flatMap((s) => (specKey(s) === specKey(old) ? next : [s])));
  };

  createEffect(() => {
    const wanted = new Set(specs().map(specKey));
    for (const [key, unsubscribe] of subs) {
      if (!wanted.has(key)) {
        unsubscribe();
        subs.delete(key);
      }
    }
    for (const spec of specs()) {
      const key = specKey(spec);
      if (subs.has(key)) continue;
      const paginationOpts = { numItems, cursor: spec.cursor, ...(spec.endCursor ? { endCursor: spec.endCursor } : {}) };
      subs.set(
        key,
        convex.onUpdate(
          query,
          { paginationOpts },
          (r: PageResult<T>) => {
            setError(null);
            setResults((prev) => ({ ...prev, [key]: r }));
            if (!spec.endCursor && !r.isDone) {
              replaceSpec(spec, [{ cursor: spec.cursor, endCursor: r.continueCursor }], r);
            } else if (r.splitCursor && (r.pageStatus === 'SplitRecommended' || r.pageStatus === 'SplitRequired')) {
              replaceSpec(spec, [
                { cursor: spec.cursor, endCursor: r.splitCursor },
                { cursor: r.splitCursor, endCursor: spec.endCursor ?? r.continueCursor },
              ]);
            }
          },
          (err: Error) => setError(err),
        ),
      );
    }
  });
  onCleanup(() => {
    for (const unsubscribe of subs.values()) unsubscribe();
    subs.clear();
  });

  // Rows of every page loaded so far, stopping at the first one still loading.
  const items = () => {
    const out: T[] = [];
    for (const spec of specs()) {
      const r = results()[specKey(spec)];
      if (!r) return out;
      out.push(...r.page);
    }
    return out;
  };
  const last = () => {
    const list = specs();
    return results()[specKey(list[list.length - 1])];
  };
  const loaded = () => specs().every((s) => results()[specKey(s)] !== undefined);
  const isDone = () => loaded() && (last()?.isDone ?? false);
  const loadMore = () => {
    const r = last();
    if (!r || r.isDone) return;
    setSpecs((list) => [...list, { cursor: r.continueCursor }]);
  };

  return { items, firstLoaded: () => results()[specKey(specs()[0])] !== undefined, loading: () => !loaded(), isDone, loadMore, error };
}

// ── Formatting ─────────────────────────────────────────────────────────

export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);
export const prob = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(2));

export function ago(ts: number | null | undefined): string {
  if (!ts) return 'never';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const fullDate = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const displayName = (s: { name: string | null; email: string | null }) =>
  s.name?.trim() || s.email?.split('@')[0] || 'Unnamed student';

// ── Example mode ───────────────────────────────────────────────────────

const MODE_LABEL: Record<ReplyMode, string> = {
  complete: 'Complete',
  faded: 'Faded',
  erroneous: 'Erroneous',
  control: 'Control',
  blocked: 'Blocked',
};

const MODE_HINT: Record<ReplyMode, string> = {
  complete: 'Mastery below 0.30: the tutor shows fully worked examples',
  faded: 'Mastery 0.30–0.70: the tutor shows examples with steps left for the student',
  erroneous: 'Mastery above 0.70: the tutor shows examples with a bug to find',
  control: 'Control group: tutor without examples',
  blocked: 'The input guardrail blocked this message',
};

const MODE_CLASS: Record<ReplyMode, string> = {
  complete: 'text-brass border-brass/40',
  faded: 'text-ink border-ink/30',
  erroneous: 'text-ivy border-ivy/40',
  control: 'text-muted border-line',
  blocked: 'text-garnet border-garnet/40',
};

export const ModeTag: Component<{ mode: ReplyMode | null | undefined }> = (props) => (
  <Show when={props.mode} fallback={<span class="text-muted">—</span>}>
    {(mode) => (
      <span
        title={MODE_HINT[mode()]}
        class={`inline-flex items-center rounded-[3px] border px-1.5 py-px font-mono text-[11px] uppercase tracking-[0.08em] ${MODE_CLASS[mode()]}`}
      >
        {MODE_LABEL[mode()]}
      </span>
    )}
  </Show>
);

export const modeLabel = (m: ReplyMode | null | undefined) => (m ? MODE_LABEL[m] : '—');

// ── Status ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<LessonStatus, string> = {
  pending: 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed',
};

export const StatusText: Component<{ status: LessonStatus }> = (props) => (
  <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
    <span
      aria-hidden="true"
      class="w-1.5 h-1.5 rounded-full"
      classList={{
        'bg-ivy': props.status === 'completed',
        'bg-brass': props.status === 'in-progress',
        'border border-muted': props.status === 'pending',
      }}
    />
    {STATUS_LABEL[props.status]}
  </span>
);

// ── Hover card ─────────────────────────────────────────────────────────

/**
 * Details shown on hover or keyboard focus. Rendered in a portal with fixed
 * positioning so table scroll containers don't clip it; flips above the
 * trigger near the bottom of the window.
 */
export const HoverCard: Component<{ trigger: JSX.Element; children: JSX.Element; class?: string }> = (props) => {
  const [pos, setPos] = createSignal<{ x: number; y: number; above: boolean } | null>(null);
  const id = createUniqueId();
  let el!: HTMLSpanElement;
  const hide = () => {
    setPos(null);
    window.removeEventListener('scroll', hide, true);
  };
  const show = () => {
    const r = el.getBoundingClientRect();
    const above = r.bottom + 220 > window.innerHeight && r.top > 220;
    setPos({ x: Math.min(Math.max(8, r.left), window.innerWidth - 300), y: above ? r.top - 8 : r.bottom + 8, above });
    window.addEventListener('scroll', hide, true);
  };
  onCleanup(hide);
  return (
    <span
      ref={el}
      tabindex="0"
      aria-describedby={pos() ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
      class={`cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-garnet ${props.class ?? ''}`}
    >
      {props.trigger}
      <Show when={pos()}>
        {(p) => (
          <Portal>
            <div
              id={id}
              role="tooltip"
              class="fixed z-50 w-[18.5rem] rounded-md border border-line bg-white px-4 py-3 text-[13px] leading-snug text-body shadow-[0_6px_24px_-8px_rgba(26,34,56,0.28)] pointer-events-none"
              style={{ left: `${p().x}px`, top: `${p().y}px`, transform: p().above ? 'translateY(-100%)' : undefined }}
            >
              {props.children}
            </div>
          </Portal>
        )}
      </Show>
    </span>
  );
};

const CardLabel: Component<{ children: JSX.Element }> = (props) => (
  <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{props.children}</p>
);

// ── What the tutor is serving ──────────────────────────────────────────

const EXAMPLE_MODES: ReplyMode[] = ['complete', 'faded', 'erroneous'];
const isExample = (m: ReplyMode | null | undefined): m is ExampleMode => !!m && EXAMPLE_MODES.includes(m);
// Mastery before any graded Submit: the server's BKT prior (P-Init) unless the topic overrides it.
const PRIOR = 0.15;

export type Serving =
  | { kind: 'control'; at: number | null }
  | { kind: 'examples'; next: ExampleMode; fromPrior: boolean; last: { mode: ExampleMode; at: number } | null }
  | { kind: 'unknown'; next: ExampleMode; fromPrior: boolean };

/**
 * What the tutor would generate next on this lesson. A student's group (example
 * tutor or normal tutor) is decided on each request, so it is read from the
 * replies they actually got, never assumed from mastery.
 */
export function servingNow(
  mastery: number | null,
  lastReply: { mode: ReplyMode | null; at: number } | null,
  tutor: TutorGroup | null,
): Serving {
  const next = modeOf(mastery ?? PRIOR);
  const fromPrior = mastery == null;
  if (lastReply?.mode === 'control') return { kind: 'control', at: lastReply.at };
  if (lastReply && isExample(lastReply.mode)) return { kind: 'examples', next, fromPrior, last: { mode: lastReply.mode, at: lastReply.at } };
  if (tutor === 'control') return { kind: 'control', at: null };
  if (tutor) return { kind: 'examples', next, fromPrior, last: null };
  return { kind: 'unknown', next, fromPrior };
}

/** The mode tag for what's being generated: the normal tutor, or the next example. Null before any reply. */
export const servingMode = (sv: Serving): ReplyMode | null =>
  sv.kind === 'control' ? 'control' : sv.kind === 'examples' ? sv.next : null;

const exampleReplies = (r: ReplyCounts) => r.complete + r.faded + r.erroneous;
const totalReplies = (r: ReplyCounts) => REPLY_ORDER.reduce((n, k) => n + r[k], 0);

const ServingDetail: Component<{ serving: Serving; mastery: number | null; replies?: ReplyCounts }> = (props) => {
  const mixed = () => (props.replies && props.replies.control > 0 && exampleReplies(props.replies) > 0 ? props.replies : null);
  const control = () => (props.serving.kind === 'control' ? props.serving : null);
  const generating = () => (props.serving.kind !== 'control' ? props.serving : null);
  const last = () => (props.serving.kind === 'examples' ? props.serving.last : null);
  return (
    <div class="mt-2.5 pt-2.5 border-t border-line space-y-1.5">
      <CardLabel>Being generated now</CardLabel>
      <Show when={control()}>
        {(c) => (
          <>
            <p class="flex items-center gap-2"><ModeTag mode="control" /> <span class="text-ink">no examples</span></p>
            <p>
              <Show
                when={c().at}
                fallback={<>Every reply this student has had so far came from the normal tutor, so no worked examples are expected.</>}
              >
                {(at) => <>The latest reply on this lesson came from the normal tutor ({ago(at())}), so no worked examples are being generated, whatever the mastery.</>}
              </Show>
            </p>
          </>
        )}
      </Show>
      <Show when={generating()}>
        {(g) => (
          <>
            <p class="flex items-center gap-2">
              <span class="text-ink">{g().kind === 'unknown' ? 'If in the example group:' : 'Next example:'}</span>
              <ModeTag mode={g().next} />
            </p>
            <p>
              <Show
                when={!g().fromPrior}
                fallback={<>No graded Submit on this topic yet, so the tutor starts from the BKT prior (about {PRIOR.toFixed(2)}).</>}
              >
                From mastery {prob(props.mastery)} ({BAND_RANGE[g().next]}).
              </Show>
            </p>
            <Show when={last()}>
              {(l) => (
                <p class="text-muted">
                  Last example reply: {MODE_LABEL[l().mode]}, {ago(l().at)}
                  {l().mode !== g().next ? ' — mastery has moved since.' : '.'}
                </p>
              )}
            </Show>
            <Show when={g().kind === 'unknown'}>
              <p class="text-muted">No tutor reply yet. Students in the normal-tutor group get no examples.</p>
            </Show>
          </>
        )}
      </Show>
      <Show when={mixed()}>
        {(r) => (
          <p class="text-brass">
            Mixed sessions: {r().control} of {totalReplies(r())} replies so far came from the normal tutor.
          </p>
        )}
      </Show>
    </div>
  );
};

// ── Mastery rule ───────────────────────────────────────────────────────

const BAND_MEANING: Record<ExampleMode, string> = {
  complete: 'fully worked examples',
  faded: 'examples with steps left for the student',
  erroneous: 'examples with a bug to find',
};

/**
 * Mastery as a ruler: the fill is P(L), the ticks are where the tutor changes
 * example mode (0.30, 0.70) and where a topic counts as mastered (0.95).
 * Hover for the band and, given `serving`, what the tutor is generating now.
 */
export const MasteryRule: Component<{
  value: number | null;
  compact?: boolean;
  serving?: Serving;
  replies?: ReplyCounts;
}> = (props) => (
  <HoverCard
    class="flex items-center gap-2.5 min-w-0"
    trigger={
      <>
        <span class="font-mono text-[13px] tabular-nums text-ink w-9 shrink-0">{prob(props.value)}</span>
        <div
          role="meter"
          aria-label="Mastery"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={props.value ?? undefined}
          aria-valuetext={props.value == null ? 'No graded Submit yet' : `${prob(props.value)}, ${modeLabel(modeOf(props.value))} band`}
          class={`relative h-2 bg-line/80 rounded-[1px] ${props.compact ? 'w-20' : 'w-full min-w-24'}`}
        >
          <Show when={props.value != null}>
            <div class="absolute inset-y-0 left-0 bg-ink rounded-[1px]" style={{ width: `${(props.value ?? 0) * 100}%` }} />
          </Show>
          <span class="absolute -top-0.5 -bottom-0.5 left-[30%] w-px bg-muted/70" />
          <span class="absolute -top-0.5 -bottom-0.5 left-[70%] w-px bg-muted/70" />
          <span class="absolute -top-0.5 -bottom-0.5 left-[95%] w-px bg-garnet" />
        </div>
      </>
    }
  >
    <CardLabel>Topic mastery</CardLabel>
    <Show when={props.value != null} fallback={<p class="mt-1">No graded Submit on this topic yet.</p>}>
      <p class="mt-1">
        <span class="font-mono text-ink">{prob(props.value)}</span> · {modeLabel(modeOf(props.value!))} band: {BAND_MEANING[modeOf(props.value!)]} for
        students in the example group.
        <Show when={props.value! >= 0.95}> Mastered.</Show>
      </p>
    </Show>
    <Show when={props.serving}>
      {(sv) => <ServingDetail serving={sv()} mastery={props.value} replies={props.replies} />}
    </Show>
  </HoverCard>
);

function modeOf(m: number): ExampleMode {
  return m < 0.3 ? 'complete' : m <= 0.7 ? 'faded' : 'erroneous';
}

// ── Tutor group and reply mix ──────────────────────────────────────────

const REPLY_ORDER: ReplyKind[] = ['complete', 'faded', 'erroneous', 'control', 'blocked', 'other'];
const REPLY_LABEL: Record<ReplyKind, string> = {
  complete: 'Complete example',
  faded: 'Faded example',
  erroneous: 'Erroneous example',
  control: 'Normal tutor',
  blocked: 'Blocked by guardrail',
  other: 'Unrecognised model',
};
const REPLY_FILL: Record<ReplyKind, string> = {
  complete: 'bg-brass',
  faded: 'bg-ink',
  erroneous: 'bg-ivy',
  control: 'bg-muted/45',
  blocked: 'bg-garnet',
  other: 'bg-line',
};

const TUTOR_LABEL: Record<TutorGroup, string> = { examples: 'Examples', control: 'Normal tutor', mixed: 'Mixed' };
const TUTOR_CLASS: Record<TutorGroup, string> = {
  examples: 'text-ink border-ink/30',
  control: 'text-muted border-line',
  mixed: 'text-brass border-brass/40',
};

/** Stacked bar of tutor replies by who wrote them, with a legend. */
export const ReplyMix: Component<{ replies: ReplyCounts; compact?: boolean }> = (props) => {
  const total = () => totalReplies(props.replies);
  const shown = () => REPLY_ORDER.filter((k) => props.replies[k] > 0);
  return (
    <Show when={total() > 0} fallback={<p class="text-sm text-muted">No tutor replies yet.</p>}>
      <div
        role="img"
        aria-label={`${total()} tutor replies: ${shown().map((k) => `${props.replies[k]} ${REPLY_LABEL[k]}`).join(', ')}`}
        class={`flex w-full overflow-hidden rounded-[1px] bg-paper ${props.compact ? 'h-2' : 'h-4'}`}
      >
        <For each={shown()}>
          {(k) => <div class={REPLY_FILL[k]} style={{ width: `${(props.replies[k] / total()) * 100}%`, 'min-width': '2px' }} />}
        </For>
      </div>
      <ul class={`grid grid-cols-[auto_1fr_auto] gap-x-2.5 gap-y-1 text-[12px] ${props.compact ? 'mt-2' : 'mt-3'}`}>
        <For each={shown()}>
          {(k) => (
            <li class="contents">
              <span aria-hidden="true" class={`mt-1 w-2.5 h-2.5 rounded-[1px] ${REPLY_FILL[k]}`} />
              <span>{REPLY_LABEL[k]}</span>
              <span class="font-mono tabular-nums text-ink text-right">
                {props.replies[k]} <span class="text-muted">· {pct(props.replies[k] / total())}</span>
              </span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
};

/** Which tutor a student has been getting; hover for their reply mix. */
export const TutorTag: Component<{ tutor: TutorGroup | null; replies: ReplyCounts }> = (props) => (
  <Show when={props.tutor} fallback={<span class="text-muted">No replies</span>}>
    {(g) => (
      <HoverCard
        trigger={
          <span class={`inline-flex items-center rounded-[3px] border px-1.5 py-px font-mono text-[11px] uppercase tracking-[0.08em] whitespace-nowrap ${TUTOR_CLASS[g()]}`}>
            {TUTOR_LABEL[g()]}
          </span>
        }
      >
        <CardLabel>Tutor replies so far</CardLabel>
        <div class="mt-2"><ReplyMix replies={props.replies} compact /></div>
        <p class="mt-2.5 text-muted">
          {g() === 'mixed'
            ? 'This student has had both example and normal-tutor sessions; the group is decided per request.'
            : g() === 'control'
              ? 'Only the normal tutor so far: no worked examples, whatever the mastery.'
              : 'Only the example tutor so far.'}
        </p>
      </HoverCard>
    )}
  </Show>
);

/** Panel: every tutor reply in scope, by who wrote it. */
export const ReplyMixPanel: Component<{ replies: ReplyCounts; scope: string }> = (props) => (
  <figure class="rounded-md border border-line bg-white p-5">
    <figcaption>
      <h2 class="font-display text-lg text-ink">Who wrote the tutor replies</h2>
      <p class="mt-1 text-sm text-body">
        Every tutor reply {props.scope} got, by the model that wrote it. A student's group is decided on each request, so not every
        session gets examples.
      </p>
    </figcaption>
    <div class="mt-4"><ReplyMix replies={props.replies} /></div>
  </figure>
);

// ── Example allowance ──────────────────────────────────────────────────

/** Where the student stands on examples this round, in words. */
export function exampleStatus(ex: { used: number; cap: number; remaining: number }): string {
  if (ex.used >= ex.cap) return 'all used this round';
  if (ex.remaining > 0) return `${ex.remaining} unlocked, not yet asked for`;
  return ex.used === 0 ? 'first unlocks on a failed Submit' : 'next unlocks on a failed Submit';
}

// ── Misc ───────────────────────────────────────────────────────────────

export const LiveDot: Component<{ ok: boolean }> = (props) => (
  <span class="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]" classList={{ 'text-ivy': props.ok, 'text-brass': !props.ok }}>
    <span class="relative flex w-1.5 h-1.5">
      <Show when={props.ok}>
        <span class="absolute inset-0 rounded-full bg-ivy/60 animate-ping motion-reduce:hidden" />
      </Show>
      <span class="relative w-1.5 h-1.5 rounded-full" classList={{ 'bg-ivy': props.ok, 'bg-brass': !props.ok }} />
    </span>
    {props.ok ? 'Live' : 'Reconnecting'}
  </span>
);

// ── First try by mastery band ──────────────────────────────────────────

const BAND_RANGE: Record<ExampleMode, string> = {
  complete: 'mastery below 0.30',
  faded: 'mastery 0.30–0.70',
  erroneous: 'mastery above 0.70',
};

// Below this many lessons a bar is shown faded and flagged as rough.
const FEW = 5;

/**
 * Horizontal bars: of the lessons a student started in each mastery band,
 * the share passed on the first Submit. 100% = every one of them passed first time.
 */
export const BandChart: Component<{ bands: BandStat[]; scope: string }> = (props) => {
  const total = () => props.bands.reduce((n, b) => n + b.lessons, 0);
  return (
    <figure class="rounded-md border border-line bg-white p-5">
      <figcaption>
        <h2 class="font-display text-lg text-ink">First-try passes by mastery going in</h2>
        <p class="mt-1 text-sm text-body">
          Of the lessons {props.scope} submitted, the share that passed on the first Submit, grouped by topic mastery just before that Submit. Bands are mastery levels: lessons from normal-tutor sessions, which got no examples, are counted too.
        </p>
      </figcaption>

      <div class="mt-5 grid grid-cols-[minmax(0,9.5rem)_1fr] gap-x-4">
        {/* Scale */}
        <span />
        <div class="relative h-4 font-mono text-[10px] text-muted" aria-hidden="true">
          <For each={[0, 25, 50, 75, 100]}>
            {(t) => (
              <span class="absolute -translate-x-1/2" classList={{ 'translate-x-0': t === 0, '-translate-x-full': t === 100 }} style={{ left: `${t}%` }}>
                {t}%
              </span>
            )}
          </For>
        </div>

        <For each={props.bands}>
          {(b) => {
            const rate = () => (b.lessons ? b.firstTry / b.lessons : null);
            const few = () => b.lessons > 0 && b.lessons < FEW;
            return (
              <>
                <div class="py-2.5 border-t border-line/70">
                  <ModeTag mode={b.band} />
                  <p class="mt-1 text-[11px] text-muted">{BAND_RANGE[b.band]}</p>
                </div>
                <div class="py-2.5 border-t border-line/70">
                  <div
                    role="img"
                    aria-label={rate() == null
                      ? `${b.band}: no lessons yet`
                      : `${b.band}: ${pct(rate())} passed first try, ${b.firstTry} of ${b.lessons} lessons${few() ? ', too few to rely on' : ''}`}
                    class="relative h-5 bg-paper"
                  >
                    <For each={[25, 50, 75]}>
                      {(t) => <span aria-hidden="true" class="absolute inset-y-0 w-px bg-line" style={{ left: `${t}%` }} />}
                    </For>
                    <Show when={rate() != null}>
                      <div
                        class="absolute inset-y-0 left-0"
                        classList={{ 'bg-ink': !few(), 'bg-ink/35': few() }}
                        style={{ width: `${rate()! * 100}%`, 'min-width': rate()! > 0 ? '2px' : '0' }}
                      />
                    </Show>
                  </div>
                  <p class="mt-1 text-[12px] text-body">
                    <Show when={rate() != null} fallback={<span class="text-muted">No lessons yet</span>}>
                      <span class="font-mono tabular-nums text-ink">{pct(rate())}</span>
                      <span class="text-muted"> · {b.firstTry} of {b.lessons} lesson{b.lessons === 1 ? '' : 's'}</span>
                      <Show when={few()}><span class="text-brass"> · too few to rely on</span></Show>
                    </Show>
                  </p>
                </div>
              </>
            );
          }}
        </For>
      </div>

      <p class="mt-4 text-[11px] text-muted">
        {total()} lesson{total() === 1 ? '' : 's'} counted. Mastery going in is recorded from Submits made after this view launched, so older lessons aren't included.
      </p>
    </figure>
  );
};

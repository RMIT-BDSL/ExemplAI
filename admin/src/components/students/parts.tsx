import { Component, For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import type { FunctionReference } from 'convex/server';
import { convex } from '../../lib/convex';
import type { BandStat, ExampleMode, LessonStatus, ReplyMode } from './types';

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

// ── Mastery rule ───────────────────────────────────────────────────────

/**
 * Mastery as a ruler: the fill is P(L), the ticks are where the tutor changes
 * example mode (0.30, 0.70) and where a topic counts as mastered (0.95).
 */
export const MasteryRule: Component<{ value: number | null; compact?: boolean }> = (props) => (
  <div class="flex items-center gap-2.5 min-w-0">
    <span class="font-mono text-[13px] tabular-nums text-ink w-9 shrink-0">{prob(props.value)}</span>
    <div
      role="meter"
      aria-label="Mastery"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={props.value ?? undefined}
      aria-valuetext={props.value == null ? 'No graded Submit yet' : `${prob(props.value)}, ${modeLabel(modeOf(props.value))} examples`}
      class={`relative h-2 bg-line/80 rounded-[1px] ${props.compact ? 'w-20' : 'w-full min-w-24'}`}
    >
      <Show when={props.value != null}>
        <div class="absolute inset-y-0 left-0 bg-ink rounded-[1px]" style={{ width: `${(props.value ?? 0) * 100}%` }} />
      </Show>
      <span class="absolute -top-0.5 -bottom-0.5 left-[30%] w-px bg-muted/70" />
      <span class="absolute -top-0.5 -bottom-0.5 left-[70%] w-px bg-muted/70" />
      <span class="absolute -top-0.5 -bottom-0.5 left-[95%] w-px bg-garnet" />
    </div>
  </div>
);

function modeOf(m: number): ExampleMode {
  return m < 0.3 ? 'complete' : m <= 0.7 ? 'faded' : 'erroneous';
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
          Of the lessons {props.scope} submitted, the share that passed on the first Submit, grouped by topic mastery just before that Submit.
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

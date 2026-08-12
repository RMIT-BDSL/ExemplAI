import { Component, createSignal, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import type { ReleaseNoteType } from './types';

interface Props {
  onCreated: () => void;
}

const TYPES: { value: ReleaseNoteType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'fix', label: 'Fix' },
];

const CreateReleaseNoteForm: Component<Props> = (props) => {
  const [title, setTitle] = createSignal('');
  const [type, setType] = createSignal<ReleaseNoteType>('feature');
  const [content, setContent] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title().trim() || !content().trim()) return;

    setSubmitting(true);
    setError('');
    try {
      await convex.mutation(api.releaseNotes.create, {
        type: type(),
        title: title().trim(),
        content: content().trim(),
      });
      setTitle('');
      setType('feature');
      setContent('');
      props.onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create release note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="rounded-md border border-line bg-white">
      <div class="px-6 pt-5 pb-4 border-b border-line">
        <h2 class="font-display text-xl text-ink flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5 text-garnet">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
          </svg>
          Create a release note
        </h2>
        <p class="mt-1.5 text-sm text-body">
          Announce the latest changes to students. Notes appear on the student-facing changelog.
        </p>
      </div>

      <form onsubmit={handleSubmit} class="p-6 space-y-5">
        {/* Title */}
        <div>
          <label for="rn_title" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Title
          </label>
          <input
            id="rn_title"
            type="text"
            placeholder="e.g. Dark mode is here"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            class="mt-2 w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition placeholder:text-muted/60"
            required
          />
        </div>

        {/* Type */}
        <div>
          <span class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Type
          </span>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {TYPES.map((t) => {
              const isActive = () => type() === t.value;
              return (
                <button
                  type="button"
                  onClick={() => setType(t.value)}
                  class={`text-[11px] font-mono px-3 py-1.5 rounded-md border transition-all ${
                    isActive()
                      ? 'border-garnet bg-garnet text-white font-semibold shadow-sm shadow-garnet/10'
                      : 'border-line bg-paper text-body hover:bg-line/45 hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div>
          <label for="rn_content" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Content
          </label>
          <textarea
            id="rn_content"
            rows={4}
            placeholder="Summarise what changed and why it matters."
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            class="mt-2 w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition placeholder:text-muted/60 resize-y"
            required
          />
        </div>

        <Show when={error()}>
          <div class="flex items-start gap-2 rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>{error()}</span>
          </div>
        </Show>

        <button
          type="submit"
          disabled={submitting() || !title().trim() || !content().trim()}
          class="inline-flex items-center justify-center gap-2 rounded-md bg-garnet px-5 py-2.5 text-sm font-medium text-paper hover:bg-garnet-deep disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          <Show
            when={submitting()}
            fallback={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            <svg class="animate-spin h-4 w-4 text-paper" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </Show>
          <span>{submitting() ? 'Publishing…' : 'Publish release note'}</span>
        </button>
      </form>
    </div>
  );
};

export default CreateReleaseNoteForm;

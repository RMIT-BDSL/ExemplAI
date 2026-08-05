import { Component, createResource, Show } from 'solid-js';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';
import CreateReleaseNoteForm from '../components/release-notes/CreateReleaseNoteForm';
import ReleaseNotesList from '../components/release-notes/ReleaseNotesList';
import type { ReleaseNote } from '../components/release-notes/types';

async function fetchNotes(): Promise<ReleaseNote[]> {
  return await convex.query(api.releaseNotes.list, {});
}

const ReleaseNotesPage: Component = () => {
  const [notes, { refetch }] = createResource<ReleaseNote[]>(fetchNotes);

  return (
    <div class="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-7">
      <header class="border-b border-line pb-7">
        <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Product updates</p>
        <h1 class="mt-3 font-display text-[30px] sm:text-[36px] leading-tight tracking-[-0.01em] text-ink">
          Release notes
        </h1>
        <p class="mt-2 max-w-xl text-[15px] text-body">
          Draft a changelog entry so students know what's new. Notes are published immediately.
        </p>
      </header>

      <CreateReleaseNoteForm onCreated={refetch} />

      <Show when={notes.error}>
        <div class="rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">
          Failed to load release notes. Check your connection (VITE_CONVEX_URL) and refresh.
        </div>
      </Show>

      <Show
        when={!notes.loading}
        fallback={
          <div class="rounded-md border border-line bg-white px-6 py-16 text-center text-sm text-muted">
            Loading release notes…
          </div>
        }
      >
        <Show when={notes()}>
          <ReleaseNotesList notes={notes()!} />
        </Show>
      </Show>
    </div>
  );
};

export default ReleaseNotesPage;

import { Component, createSignal, For, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';

interface Props {
  onCreated: () => void;
}

const CreateCourseForm: Component<Props> = (props) => {
  const [newName, setNewName] = createSignal('');
  const [newLanguage, setNewLanguage] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [createError, setCreateError] = createSignal('');

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!newName().trim() || !newLanguage().trim()) return;

    setCreating(true);
    setCreateError('');
    try {
      await convex.mutation(api.courses.createCourse, {
        course_name: newName().trim(),
        course_language: newLanguage().trim(),
      });
      setNewName('');
      setNewLanguage('');
      props.onCreated();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  };

  const languages = [
    'Python',
    'JavaScript',
    'TypeScript',
    'C++',
    'Java',
    'Go',
    'Rust',
    'SQL',
    'HTML/CSS'
  ];

  return (
    <div class="rounded-md border border-line bg-white shadow-sm">
      <div class="px-6 pt-5 pb-4 border-b border-line">
        <h2 class="font-display text-xl text-ink">Create a course</h2>
        <p class="mt-1 text-sm text-body font-sans">
          Add a new course curriculum container to teach students.
        </p>
      </div>

      <form onSubmit={handleCreate} class="p-6 space-y-5">
        <div>
          <label for="course_name" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Course Name
          </label>
          <input
            id="course_name"
            type="text"
            placeholder="e.g. Introduction to Programming"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            class="mt-2 w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition"
            required
          />
        </div>

        <div>
          <label for="course_language" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Language
          </label>
          <div class="relative mt-2">
            <input
              id="course_language"
              type="text"
              placeholder="e.g. Python"
              value={newLanguage()}
              onInput={(e) => setNewLanguage(e.currentTarget.value)}
              class="w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition"
              required
            />
            {/* Language Suggestions */}
            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <For each={languages}>
                {(lang) => (
                  <button
                    type="button"
                    onClick={() => setNewLanguage(lang)}
                    class="text-[11px] font-mono px-2 py-0.5 rounded border border-line bg-paper text-body hover:bg-line/40 transition"
                  >
                    {lang}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={creating() || !newName().trim() || !newLanguage().trim()}
          class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          {creating() ? 'Creating…' : 'Create Course'}
        </button>
      </form>

      <Show when={createError()}>
        <div class="mx-6 mb-6 flex items-start gap-2 rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{createError()}</span>
        </div>
      </Show>
    </div>
  );
};

export default CreateCourseForm;

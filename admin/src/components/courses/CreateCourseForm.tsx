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
    <div class="rounded-xl border border-line bg-white/95 shadow-md shadow-ink/5 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-ink/8">
      <div class="px-6 py-5 border-b border-line bg-paper/30">
        <h2 class="font-display text-xl text-ink font-semibold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-garnet">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Create a course
        </h2>
        <p class="mt-1.5 text-xs text-body font-sans leading-relaxed">
          Add a new course curriculum container to teach students.
        </p>
      </div>

      <form onSubmit={handleCreate} class="p-6 space-y-6">
        <div>
          <label for="course_name" class="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            Course Name
          </label>
          <div class="relative mt-2">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <input
              id="course_name"
              type="text"
              placeholder="e.g. Introduction to Programming"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              class="w-full rounded-lg border border-line bg-white pl-10 pr-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-4 focus:ring-garnet/10 transition-all placeholder:text-muted/60"
              required
            />
          </div>
        </div>

        <div>
          <label for="course_language" class="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">
            Language
          </label>
          <div class="relative mt-2">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
            </div>
            <input
              id="course_language"
              type="text"
              placeholder="e.g. Python"
              value={newLanguage()}
              onInput={(e) => setNewLanguage(e.currentTarget.value)}
              class="w-full rounded-lg border border-line bg-white pl-10 pr-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-4 focus:ring-garnet/10 transition-all placeholder:text-muted/60"
              required
            />
            {/* Language Suggestions */}
            <div class="mt-3 flex flex-wrap gap-1.5">
              <For each={languages}>
                {(lang) => {
                  const isActive = () => newLanguage().trim().toLowerCase() === lang.trim().toLowerCase();
                  return (
                    <button
                      type="button"
                      onClick={() => setNewLanguage(lang)}
                      class={`text-[10px] font-mono px-2.5 py-1 rounded-md border transition-all ${
                        isActive()
                          ? 'border-garnet bg-garnet text-white font-semibold shadow-sm shadow-garnet/10'
                          : 'border-line bg-paper text-body hover:bg-line/45 hover:text-ink'
                      }`}
                    >
                      {lang}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={creating() || !newName().trim() || !newLanguage().trim()}
          class="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm active:scale-[0.98]"
        >
          <Show when={creating()} fallback={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            <svg class="animate-spin h-4 w-4 text-paper" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </Show>
          <span>{creating() ? 'Creating Course…' : 'Create Course'}</span>
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

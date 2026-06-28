import { Component, createSignal, For, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import type { Course } from './CourseList';

interface Props {
  course: Course;
  onClose: () => void;
  onUpdated: () => void;
}

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

const EditCourseModal: Component<Props> = (props) => {
  const [editName, setEditName] = createSignal(props.course.course_name);
  const [editLanguage, setEditLanguage] = createSignal(props.course.course_language);
  const [updating, setUpdating] = createSignal(false);
  const [updateError, setUpdateError] = createSignal('');

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    if (!editName().trim() || !editLanguage().trim()) return;

    setUpdating(true);
    setUpdateError('');
    try {
      await convex.mutation(api.courses.updateCourse, {
        id: props.course._id,
        course_name: editName().trim(),
        course_language: editLanguage().trim(),
      });
      props.onUpdated();
      props.onClose();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update course');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div class="bg-[#1E293B] text-white border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={props.onClose}
          class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4.5 h-4.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <header class="border-b border-white/10 pb-4">
          <h3 class="font-display text-xl text-white font-semibold">Edit Course</h3>
          <p class="mt-1 text-xs text-slate-400 font-sans">
            Modify course metadata. Changes apply immediately.
          </p>
        </header>

        <form onSubmit={handleUpdate} class="mt-5 space-y-5">
          <div>
            <label for="edit_name" class="block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
              Course Name
            </label>
            <div class="relative mt-2">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <input
                id="edit_name"
                type="text"
                value={editName()}
                onInput={(e) => setEditName(e.currentTarget.value)}
                class="w-full rounded-lg border border-white/10 bg-[#0f172a] pl-10 pr-3.5 py-2.5 text-sm text-white outline-none focus:border-garnet focus:ring-4 focus:ring-garnet/20 transition-all placeholder:text-slate-500"
                required
              />
            </div>
          </div>

          <div>
            <label for="edit_language" class="block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
              Language
            </label>
            <div class="relative mt-2">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
              </div>
              <input
                id="edit_language"
                type="text"
                value={editLanguage()}
                onInput={(e) => setEditLanguage(e.currentTarget.value)}
                class="w-full rounded-lg border border-white/10 bg-[#0f172a] pl-10 pr-3.5 py-2.5 text-sm text-white outline-none focus:border-garnet focus:ring-4 focus:ring-garnet/20 transition-all placeholder:text-slate-500"
                required
              />
              {/* Language Suggestions */}
              <div class="mt-3 flex flex-wrap gap-1.5">
                <For each={languages}>
                  {(lang) => {
                    const isActive = () => editLanguage().trim().toLowerCase() === lang.trim().toLowerCase();
                    return (
                      <button
                        type="button"
                        onClick={() => setEditLanguage(lang)}
                        class={`text-[10px] font-mono px-2.5 py-1 rounded-md border transition-all ${
                          isActive()
                            ? 'border-garnet bg-garnet text-white font-semibold shadow-sm shadow-garnet/10'
                            : 'border-white/10 bg-[#151d2d] text-slate-300 hover:bg-white/5 hover:text-white'
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

          <Show when={updateError()}>
            <div class="rounded-md border border-garnet/30 bg-garnet/[0.08] px-4 py-3 text-xs text-garnet-deep flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>{updateError()}</span>
            </div>
          </Show>

          <footer class="border-t border-white/10 pt-4 flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={props.onClose}
              class="border border-white/10 bg-[#151d2d] text-slate-300 hover:bg-white/5 hover:text-white px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating() || !editName().trim() || !editLanguage().trim()}
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-garnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-garnet-deep disabled:opacity-45 disabled:cursor-not-allowed transition-colors shadow-md shadow-garnet/10 active:scale-[0.98]"
            >
              <Show when={updating()} fallback={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              }>
                <svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </Show>
              <span>{updating() ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditCourseModal;

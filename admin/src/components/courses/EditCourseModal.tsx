import { Component, createSignal, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import type { Course } from './CourseList';

interface Props {
  course: Course;
  onClose: () => void;
  onUpdated: () => void;
}

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
      <div class="bg-[#1E293B] text-white border border-white/10 rounded-lg max-w-md w-full p-6 shadow-2xl relative">
        <header class="border-b border-white/10 pb-4">
          <h3 class="font-display text-xl text-white">Edit Course</h3>
          <p class="mt-1 text-xs text-slate-400 font-sans">
            Modify course metadata. Changes apply immediately.
          </p>
        </header>

        <form onSubmit={handleUpdate} class="mt-5 space-y-5">
          <div>
            <label for="edit_name" class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Course Name
            </label>
            <input
              id="edit_name"
              type="text"
              value={editName()}
              onInput={(e) => setEditName(e.currentTarget.value)}
              class="mt-2 w-full rounded-md border border-white/10 bg-[#151d2d] px-3.5 py-2.5 text-sm text-white outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/35 transition"
              required
            />
          </div>

          <div>
            <label for="edit_language" class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Language
            </label>
            <input
              id="edit_language"
              type="text"
              value={editLanguage()}
              onInput={(e) => setEditLanguage(e.currentTarget.value)}
              class="mt-2 w-full rounded-md border border-white/10 bg-[#151d2d] px-3.5 py-2.5 text-sm text-white outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/35 transition"
              required
            />
          </div>

          <Show when={updateError()}>
            <div class="rounded-md border border-garnet/30 bg-garnet/[0.08] px-4 py-3 text-xs text-garnet-deep">
              {updateError()}
            </div>
          </Show>

          <footer class="border-t border-white/10 pt-4 flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-xs font-mono uppercase tracking-wider text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating() || !editName().trim() || !editLanguage().trim()}
              class="inline-flex items-center justify-center gap-2 rounded-md bg-garnet px-5 py-2.5 text-sm font-medium text-white hover:bg-garnet-deep disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              {updating() ? 'Saving…' : 'Save Changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditCourseModal;

import { Component, createResource, createSignal, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';
import type { GenericId as Id } from 'convex/values';

interface Course {
  _id: Id<'course'>;
  _creationTime: number;
  course_name: string;
  course_language: string;
}

async function fetchCourses(): Promise<Course[]> {
  return await convex.query(api.courses.listCourses, {});
}

const CoursesPage: Component = () => {
  const [courses, { refetch }] = createResource<Course[]>(fetchCourses);

  // Form signals for creation
  const [newName, setNewName] = createSignal('');
  const [newLanguage, setNewLanguage] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [createError, setCreateError] = createSignal('');

  // Editing state signals
  const [editingCourse, setEditingCourse] = createSignal<Course | null>(null);
  const [editName, setEditName] = createSignal('');
  const [editLanguage, setEditLanguage] = createSignal('');
  const [updating, setUpdating] = createSignal(false);
  const [updateError, setUpdateError] = createSignal('');

  // Delete status tracking
  const [actionError, setActionError] = createSignal('');

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
      refetch();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course);
    setEditName(course.course_name);
    setEditLanguage(course.course_language);
    setUpdateError('');
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    const course = editingCourse();
    if (!course || !editName().trim() || !editLanguage().trim()) return;

    setUpdating(true);
    setUpdateError('');
    try {
      await convex.mutation(api.courses.updateCourse, {
        id: course._id,
        course_name: editName().trim(),
        course_language: editLanguage().trim(),
      });
      setEditingCourse(null);
      refetch();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update course');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`Are you sure you want to delete "${course.course_name}"? \n\nWARNING: This will delete ALL lessons inside this course and student progress. This action cannot be undone.`)) {
      return;
    }

    setActionError('');
    try {
      await convex.mutation(api.courses.deleteCourse, { id: course._id });
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete course');
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
    <div class="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-7">
      <header class="border-b border-line pb-7">
        <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Curriculum</p>
        <h1 class="mt-3 font-display text-[30px] sm:text-[36px] leading-tight tracking-[-0.01em] text-ink">
          Courses
        </h1>
        <p class="mt-2 max-w-xl text-[15px] text-body">
          Manage courses and their programming languages. Select a course to view and edit its lessons.
        </p>
      </header>

      {/* Main Grid */}
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Course List */}
        <div class="lg:col-span-3 space-y-4">
          <Show when={actionError()}>
            <div class="rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>{actionError()}</span>
            </div>
          </Show>

          <div class="rounded-md border border-line bg-white overflow-hidden">
            <div class="px-6 py-4 border-b border-line flex items-baseline justify-between">
              <h2 class="font-display text-xl text-ink">All Courses</h2>
              <span class="font-mono text-xs text-muted tabular-nums">
                {courses()?.length ?? 0} {courses()?.length === 1 ? 'course' : 'courses'}
              </span>
            </div>

            <Show when={courses.error}>
              <div class="p-6 text-center text-sm text-brass">
                Failed to load courses. Check connection and refresh.
              </div>
            </Show>

            <Show
              when={!courses.loading}
              fallback={
                <div class="px-6 py-16 text-center text-sm text-muted animate-pulse">
                  Loading courses…
                </div>
              }
            >
              <Show
                when={courses() && courses()!.length > 0}
                fallback={
                  <div class="px-6 py-16 text-center">
                    <p class="font-display text-lg text-ink">No courses yet.</p>
                    <p class="mt-1.5 text-sm text-muted">Create your first course using the panel to the right.</p>
                  </div>
                }
              >
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-paper/60 border-b border-line">
                        <th class="text-left px-6 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted font-medium">Course Name</th>
                        <th class="text-left px-6 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted font-medium">Language</th>
                        <th class="text-right px-6 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={courses()}>
                        {(course) => (
                          <tr class="border-b border-line/70 last:border-0 hover:bg-paper/50 transition-colors">
                            <td class="px-6 py-4 font-medium">
                              <A
                                href={`/courses/${course._id}`}
                                class="text-garnet hover:text-garnet-deep hover:underline font-display text-base transition-colors"
                              >
                                {course.course_name}
                              </A>
                            </td>
                            <td class="px-6 py-4">
                              <span class="inline-flex items-center rounded-full bg-paper px-2.5 py-0.5 text-xs font-mono text-ink-soft border border-line">
                                {course.course_language}
                              </span>
                            </td>
                            <td class="px-6 py-4 text-right">
                              <div class="inline-flex items-center gap-2">
                                <A
                                  href={`/courses/${course._id}`}
                                  class="text-xs font-medium text-body hover:text-ink border border-line px-2.5 py-1 rounded bg-white hover:bg-paper transition"
                                >
                                  View Lessons
                                </A>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(course)}
                                  class="text-xs font-medium text-body hover:text-ink border border-line px-2.5 py-1 rounded bg-white hover:bg-paper transition"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(course)}
                                  class="text-xs font-medium text-garnet hover:text-white hover:bg-garnet border border-garnet/20 hover:border-garnet px-2.5 py-1 rounded bg-white transition"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Show>
          </div>
        </div>

        {/* Create Course Panel */}
        <div class="lg:col-span-2 rounded-md border border-line bg-white">
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
      </div>

      {/* Edit Course Modal */}
      {/* Standard solid opaque background (#1E293B) and semi-transparent overlay (rgba(0, 0, 0, 0.75)) without glassmorphism/blur */}
      <Show when={editingCourse()}>
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
                  onClick={() => setEditingCourse(null)}
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
      </Show>
    </div>
  );
};

export default CoursesPage;

import { Component, createSignal, For, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import type { Lesson } from './LessonFormModal';

interface Props {
  lessons: Lesson[];
  onEdit: (lesson: Lesson) => void;
  onAddLesson: (week: number) => void;
  onDeleted: () => void;
}

const LessonList: Component<Props> = (props) => {
  const [actionError, setActionError] = createSignal('');

  const handleDelete = async (lesson: Lesson) => {
    if (!confirm(`Are you sure you want to delete lesson "${lesson.problem_name}"?\n\nWARNING: This will permanently delete student progress for this lesson. This cannot be undone.`)) {
      return;
    }

    setActionError('');
    try {
      await convex.mutation(api.lessons.deleteLesson, { id: lesson._id });
      props.onDeleted();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete lesson.');
    }
  };

  const lessonsForWeek = (w: number) => {
    return props.lessons.filter(l => l.week === w);
  };

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div class="space-y-6">
      {/* Delete/Action Error Alert */}
      <Show when={actionError()}>
        <div class="rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{actionError()}</span>
        </div>
      </Show>

      <div class="space-y-6">
        <For each={weeks}>
          {(wk) => {
            const list = lessonsForWeek(wk);
            return (
              <div class="rounded-md border border-line bg-white overflow-hidden shadow-sm">
                <header class="px-6 py-4 border-b border-line bg-paper/30 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="grid place-items-center w-8 h-8 rounded bg-ink text-paper font-mono text-xs font-semibold">
                      W{wk}
                    </span>
                    <div>
                      <h3 class="font-display text-base text-ink">Week {wk} Lessons</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => props.onAddLesson(wk)}
                    class="text-xs font-medium text-body hover:text-ink hover:underline transition"
                  >
                    + Add Lesson
                  </button>
                </header>

                <Show
                  when={list.length > 0}
                  fallback={
                    <div class="px-6 py-6 text-center text-xs text-muted font-mono uppercase tracking-wider">
                      No lessons scheduled
                    </div>
                  }
                >
                  <div class="divide-y divide-line/60">
                    <For each={list}>
                      {(lesson) => (
                        <div class="p-6 flex flex-col md:flex-row md:items-start justify-between gap-5 hover:bg-paper/10 transition-colors">
                          <div class="space-y-1.5 flex-1 min-w-0">
                            <h4 class="font-display text-lg text-ink truncate">
                              {lesson.problem_name}
                            </h4>
                            <p class="text-sm text-body leading-relaxed max-w-3xl">
                              {lesson.problem_description}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                              <span class="inline-flex items-center gap-1.5 font-mono text-xs text-muted">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                                </svg>
                                {(lesson.testCases ?? []).length} Auto-grader test {(lesson.testCases ?? []).length === 1 ? 'case' : 'cases'}
                              </span>

                              <Show when={lesson.starter_code}>
                                <span class="inline-flex items-center gap-1 font-mono text-[10px] text-ivy bg-ivy/[0.06] border border-ivy/20 px-2 py-0.5 rounded">
                                  Template Code
                                </span>
                              </Show>

                              <Show when={lesson.solution_code}>
                                <span class="inline-flex items-center gap-1 font-mono text-[10px] text-brass bg-brass/[0.06] border border-brass/20 px-2 py-0.5 rounded">
                                  Reference Solution
                                </span>
                              </Show>
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0 self-end md:self-start">
                            <button
                              type="button"
                              onClick={() => props.onEdit(lesson)}
                              class="text-xs font-medium text-body hover:text-ink border border-line px-3 py-1.5 rounded bg-white hover:bg-paper transition"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(lesson)}
                              class="text-xs font-medium text-garnet hover:text-white hover:bg-garnet border border-garnet/20 hover:border-garnet px-3 py-1.5 rounded bg-white transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default LessonList;

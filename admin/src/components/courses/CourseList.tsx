import { Component, createSignal, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import type { GenericId as Id } from 'convex/values';

export interface Course {
  _id: Id<'course'>;
  _creationTime: number;
  course_name: string;
  course_language: string;
}

interface Props {
  courses: Course[];
  onEdit: (course: Course) => void;
  onDeleted: () => void;
}

const CourseList: Component<Props> = (props) => {
  const [actionError, setActionError] = createSignal('');

  const handleDelete = async (course: Course) => {
    if (!confirm(`Are you sure you want to delete "${course.course_name}"? \n\nWARNING: This will delete ALL lessons inside this course and student progress. This action cannot be undone.`)) {
      return;
    }

    setActionError('');
    try {
      await convex.mutation(api.courses.deleteCourse, { id: course._id });
      props.onDeleted();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete course');
    }
  };

  return (
    <div class="space-y-4">
      <Show when={actionError()}>
        <div class="rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{actionError()}</span>
        </div>
      </Show>

      <div class="rounded-md border border-line bg-white overflow-hidden shadow-sm">
        <div class="px-6 py-4 border-b border-line flex items-baseline justify-between">
          <h2 class="font-display text-xl text-ink">All Courses</h2>
          <span class="font-mono text-xs text-muted tabular-nums">
            {props.courses.length} {props.courses.length === 1 ? 'course' : 'courses'}
          </span>
        </div>

        <Show
          when={props.courses.length > 0}
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
                <For each={props.courses}>
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
                            onClick={() => props.onEdit(course)}
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
      </div>
    </div>
  );
};

export default CourseList;

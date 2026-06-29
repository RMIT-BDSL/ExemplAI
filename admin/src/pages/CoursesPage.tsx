import { Component, createResource, createSignal, Show } from 'solid-js';
import CourseList, { Course } from '../components/courses/CourseList';
import CreateCourseForm from '../components/courses/CreateCourseForm';
import EditCourseModal from '../components/courses/EditCourseModal';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';

async function fetchCourses(): Promise<Course[]> {
  return await convex.query(api.courses.listCourses, {});
}

const CoursesPage: Component = () => {
  const [courses, { refetch }] = createResource<Course[]>(fetchCourses);
  const [editingCourse, setEditingCourse] = createSignal<Course | null>(null);

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
        {/* Course List (Left Column) */}
        <div class="lg:col-span-3">
          <Show when={courses.error}>
            <div class="p-6 text-center text-sm text-brass rounded-md border border-brass/25 bg-brass/[0.05]">
              Failed to load courses. Check connection and refresh.
            </div>
          </Show>

          <Show
            when={!courses.loading}
            fallback={
              <div class="px-6 py-16 text-center text-sm text-muted animate-pulse rounded-md border border-line bg-white shadow-sm">
                Loading courses…
              </div>
            }
          >
            <CourseList
              courses={courses() || []}
              onEdit={setEditingCourse}
              onDeleted={refetch}
            />
          </Show>
        </div>

        {/* Create Course Panel (Right Column) */}
        <div class="lg:col-span-2">
          <CreateCourseForm onCreated={refetch} />
        </div>
      </div>

      {/* Edit Course Modal Overlay */}
      <Show when={editingCourse()}>
        <EditCourseModal
          course={editingCourse()!}
          onClose={() => setEditingCourse(null)}
          onUpdated={refetch}
        />
      </Show>
    </div>
  );
};

export default CoursesPage;

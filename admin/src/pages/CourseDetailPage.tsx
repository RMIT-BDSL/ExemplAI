import { Component, createResource, createSignal, Show } from 'solid-js';
import { useParams, A } from '@solidjs/router';
import LessonList from '../components/lessons/LessonList';
import LessonFormModal, { Lesson } from '../components/lessons/LessonFormModal';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';
import type { GenericId as Id } from 'convex/values';

interface Course {
  _id: Id<'course'>;
  _creationTime: number;
  course_name: string;
  course_language: string;
}

const CourseDetailPage: Component = () => {
  const params = useParams();
  const courseId = () => params.id as Id<'course'>;

  // Resources
  const [course] = createResource<Course | null>(() => 
    convex.query(api.courses.getCourse, { id: courseId() })
  );

  const [lessons, { refetch }] = createResource<Lesson[]>(() =>
    convex.query(api.lessons.listLessonsByCourse, { course: courseId() })
  );

  // Modal State Signals
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [editingLesson, setEditingLesson] = createSignal<Lesson | null>(null);
  const [targetWeek, setTargetWeek] = createSignal(1);

  const handleOpenCreate = (week = 1) => {
    setEditingLesson(null);
    setTargetWeek(week);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsModalOpen(true);
  };

  return (
    <div class="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-8">
      {/* Breadcrumbs & Actions */}
      <nav class="flex items-center justify-between">
        <div class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          <A href="/courses" class="hover:text-ink hover:underline transition">Courses</A>
          <span>/</span>
          <span class="text-ink truncate max-w-xs">{course()?.course_name || 'Loading...'}</span>
        </div>
      </nav>

      {/* Course Header */}
      <Show when={course()}>
        <header class="border-b border-line pb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="font-display text-[30px] sm:text-[36px] leading-tight tracking-[-0.01em] text-ink">
              {course()?.course_name}
            </h1>
            <p class="mt-2 text-sm text-body">
              Primary programming language: <span class="font-mono text-ink-soft font-semibold bg-white border border-line rounded px-2 py-0.5 ml-1">{course()?.course_language}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreate(1)}
            class="inline-flex items-center justify-center gap-2 rounded-md bg-garnet px-5 py-2.5 text-sm font-medium text-paper hover:bg-garnet-deep transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Lesson
          </button>
        </header>
      </Show>

      {/* Syllabus - Weekly Outline */}
      <div class="space-y-6">
        <Show when={lessons.error}>
          <div class="rounded-md border border-brass/30 bg-brass/[0.06] p-6 text-center text-sm text-brass">
            Failed to load syllabus lessons. Check server status and refresh.
          </div>
        </Show>

        <Show
          when={!lessons.loading}
          fallback={
            <div class="space-y-4">
              <div class="rounded-md border border-line bg-white/40 h-28 animate-pulse" />
              <div class="rounded-md border border-line bg-white/40 h-28 animate-pulse" />
              <div class="rounded-md border border-line bg-white/40 h-28 animate-pulse" />
            </div>
          }
        >
          <LessonList
            lessons={lessons() || []}
            onEdit={handleOpenEdit}
            onAddLesson={handleOpenCreate}
            onDeleted={refetch}
          />
        </Show>
      </div>

      {/* Lesson Edit/Create Modal (Solid overlay & dark solid background) */}
      <Show when={isModalOpen() && course()}>
        <LessonFormModal
          courseId={courseId()}
          courseLanguage={course()!.course_language}
          editingLesson={editingLesson()}
          initialWeek={targetWeek()}
          onClose={() => setIsModalOpen(false)}
          onSaved={refetch}
        />
      </Show>
    </div>
  );
};

export default CourseDetailPage;

import { Component, createResource, createSignal, For, Show } from 'solid-js';
import { useParams, A } from '@solidjs/router';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';
import { MonacoEditor } from '../components/MonacoEditor';
import type { GenericId as Id } from 'convex/values';

interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
  hidden?: boolean;
}

interface Lesson {
  _id: Id<'questions'>;
  _creationTime: number;
  course: Id<'course'>;
  week: number;
  problem_name: string;
  problem_description: string;
  detail?: string;
  testCases?: TestCase[];
  starter_code?: string;
  solution_code?: string;
}

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

  // Modal open/close & mode
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [editingLessonId, setEditingLessonId] = createSignal<Id<'questions'> | null>(null);

  // Lesson Form Signals
  const [week, setWeek] = createSignal(1);
  const [problemName, setProblemName] = createSignal('');
  const [problemDescription, setProblemDescription] = createSignal('');
  const [detail, setDetail] = createSignal('');
  const [testCases, setTestCases] = createSignal<TestCase[]>([]);
  const [starterCode, setStarterCode] = createSignal('');
  const [solutionCode, setSolutionCode] = createSignal('');

  // Errors / Loading
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [actionError, setActionError] = createSignal('');

  // Open modal for Create
  const handleOpenCreate = (initialWeek = 1) => {
    setEditingLessonId(null);
    setWeek(initialWeek);
    setProblemName('');
    setProblemDescription('');
    setDetail('');
    setTestCases([]);
    setStarterCode('');
    setSolutionCode('');
    setError('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (lesson: Lesson) => {
    setEditingLessonId(lesson._id);
    setWeek(lesson.week);
    setProblemName(lesson.problem_name);
    setProblemDescription(lesson.problem_description);
    setDetail(lesson.detail || '');
    setTestCases(lesson.testCases ? JSON.parse(JSON.stringify(lesson.testCases)) : []);
    setStarterCode(lesson.starter_code || '');
    setSolutionCode(lesson.solution_code || '');
    setError('');
    setIsModalOpen(true);
  };

  // Handle Form Submit (Create or Update)
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!problemName().trim() || !problemDescription().trim()) {
      setError('Please fill in problem name and summary description.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      course: courseId(),
      week: week(),
      problem_name: problemName().trim(),
      problem_description: problemDescription().trim(),
      detail: detail().trim() || undefined,
      starter_code: starterCode().trim() || undefined,
      solution_code: solutionCode().trim() || undefined,
      testCases: testCases().map(tc => ({
        input: tc.input.trim(),
        expectedOutput: tc.expectedOutput.trim(),
        description: tc.description?.trim() || undefined,
        hidden: !!tc.hidden
      }))
    };

    try {
      const id = editingLessonId();
      if (id) {
        // Update
        await convex.mutation(api.lessons.updateLesson, {
          id,
          ...payload
        });
      } else {
        // Create
        await convex.mutation(api.lessons.createLesson, payload);
      }
      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the lesson.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Lesson
  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!confirm(`Are you sure you want to delete lesson "${lesson.problem_name}"?\n\nWARNING: This will permanently delete student progress for this lesson. This cannot be undone.`)) {
      return;
    }

    setActionError('');
    try {
      await convex.mutation(api.lessons.deleteLesson, { id: lesson._id });
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete lesson.');
    }
  };

  // Test Case Utilities
  const addTestCase = () => {
    setTestCases([...testCases(), { input: '', expectedOutput: '', description: '', hidden: false }]);
  };

  const removeTestCase = (index: number) => {
    setTestCases(testCases().filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: keyof TestCase, value: any) => {
    setTestCases(
      testCases().map((tc, i) => (i === index ? { ...tc, [field]: value } : tc))
    );
  };

  // Group lessons by week
  const lessonsForWeek = (w: number) => {
    return lessons()?.filter(l => l.week === w) || [];
  };

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

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

      {/* Delete/Action Error Alert */}
      <Show when={actionError()}>
        <div class="rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{actionError()}</span>
        </div>
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
              <For each={[1, 2, 3]}>
                {() => (
                  <div class="rounded-md border border-line bg-white/40 h-28 animate-pulse" />
                )}
              </For>
            </div>
          }
        >
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
                        onClick={() => handleOpenCreate(wk)}
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
                                  onClick={() => handleOpenEdit(lesson)}
                                  class="text-xs font-medium text-body hover:text-ink border border-line px-3 py-1.5 rounded bg-white hover:bg-paper transition"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLesson(lesson)}
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
        </Show>
      </div>

      {/* Lesson Edit/Create Modal (Solid overlay & dark solid background) */}
      <Show when={isModalOpen()}>
        <div class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div class="bg-[#1E293B] text-white border border-white/10 rounded-lg max-w-4xl w-full p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
            <header class="border-b border-white/10 pb-4 shrink-0">
              <h3 class="font-display text-xl text-white">
                {editingLessonId() ? 'Edit Lesson' : 'Create Lesson'}
              </h3>
              <p class="mt-1 text-xs text-slate-400 font-sans">
                Set week slot, program specifications, details, starting templates, and automatic grading test cases.
              </p>
            </header>

            <form onSubmit={handleSubmit} class="mt-5 space-y-6 overflow-y-auto flex-1 pr-2">
              {/* Row 1: Week & Problem Name */}
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label for="lesson_week" class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    Week slot
                  </label>
                  <select
                    id="lesson_week"
                    value={week()}
                    onChange={(e) => setWeek(Number(e.currentTarget.value))}
                    class="mt-2 w-full rounded-md border border-white/10 bg-[#151d2d] px-3 py-2.5 text-sm text-white outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/35 transition"
                  >
                    <For each={weeks}>
                      {(wk) => <option value={wk} class="bg-[#1E293B]">Week {wk}</option>}
                    </For>
                  </select>
                </div>
                <div class="sm:col-span-3">
                  <label for="lesson_name" class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    Lesson / Problem Name
                  </label>
                  <input
                    id="lesson_name"
                    type="text"
                    placeholder="e.g. FizzBuzz Challenge"
                    value={problemName()}
                    onInput={(e) => setProblemName(e.currentTarget.value)}
                    class="mt-2 w-full rounded-md border border-white/10 bg-[#151d2d] px-3.5 py-2.5 text-sm text-white outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/35 transition"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Short Description */}
              <div>
                <label for="lesson_desc" class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  Short Description
                </label>
                <textarea
                  id="lesson_desc"
                  rows="2"
                  placeholder="A concise, high-level summary of the lesson's goal."
                  value={problemDescription()}
                  onInput={(e) => setProblemDescription(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-white/10 bg-[#151d2d] px-3.5 py-2 text-sm text-white outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/35 transition resize-none"
                  required
                />
              </div>

              {/* Row 3: Markdown / Detailed Instructions */}
              <div>
                <label for="lesson_detail" class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  Detailed Instructions <span class="normal-case tracking-normal text-slate-500">— Markdown Supported</span>
                </label>
                <textarea
                  id="lesson_detail"
                  rows="4"
                  placeholder="Provide complete guidelines, background information, input/output structures, and hints..."
                  value={detail()}
                  onInput={(e) => setDetail(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-white/10 bg-[#151d2d] px-3.5 py-2 font-mono text-sm text-white outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/35 transition"
                />
              </div>

              {/* Row 4: Starter Code & Reference Solution using Monaco Editor */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/10 pt-5">
                <div>
                  <label class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-2">
                    Starter / Template Code
                  </label>
                  <MonacoEditor
                    value={starterCode()}
                    language={course()?.course_language || 'python'}
                    onChange={setStarterCode}
                    height="240px"
                  />
                  <p class="mt-2 text-[11px] text-slate-400 font-sans leading-normal">
                    The initial code skeleton template loaded inside the student's editor.
                  </p>
                </div>
                <div>
                  <label class="block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-2">
                    Reference Solution
                  </label>
                  <MonacoEditor
                    value={solutionCode()}
                    language={course()?.course_language || 'python'}
                    onChange={setSolutionCode}
                    height="240px"
                  />
                  <p class="mt-2 text-[11px] text-slate-400 font-sans leading-normal">
                    Model answer code. Useful as admin reference and system-level checks.
                  </p>
                </div>
              </div>

              {/* Test Cases Sub-section */}
              <div class="border-t border-white/10 pt-5 space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="font-display text-base text-white">Auto-grader Test Cases</h4>
                  <button
                    type="button"
                    onClick={addTestCase}
                    class="text-xs font-mono uppercase tracking-wider bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded transition text-slate-200"
                  >
                    + Add Test Case
                  </button>
                </div>

                <Show
                  when={testCases().length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed border-white/10 p-5 text-center text-xs text-slate-500 font-mono">
                      No test cases configured yet. Add test cases to support automatic grading.
                    </div>
                  }
                >
                  <div class="space-y-3.5">
                    <For each={testCases()}>
                      {(tc, idx) => (
                        <div class="rounded-md border border-white/10 bg-[#151d2d]/60 p-4 space-y-3 relative">
                          <button
                            type="button"
                            onClick={() => removeTestCase(idx())}
                            class="absolute top-3.5 right-3.5 text-slate-400 hover:text-garnet transition"
                            title="Remove test case"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4.5 h-4.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>

                          <div class="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                            Test case #{idx() + 1}
                          </div>

                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label class="block font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Input</label>
                              <textarea
                                rows="1"
                                placeholder="e.g. 15"
                                value={tc.input}
                                onInput={(e) => updateTestCase(idx(), 'input', e.currentTarget.value)}
                                class="mt-1 w-full rounded border border-white/10 bg-[#151d2d] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-garnet transition"
                                required
                              />
                            </div>
                            <div>
                              <label class="block font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Expected Output</label>
                              <textarea
                                rows="1"
                                placeholder="e.g. FizzBuzz"
                                value={tc.expectedOutput}
                                onInput={(e) => updateTestCase(idx(), 'expectedOutput', e.currentTarget.value)}
                                class="mt-1 w-full rounded border border-white/10 bg-[#151d2d] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-garnet transition"
                                required
                              />
                            </div>
                          </div>

                          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                            <div class="sm:col-span-2">
                              <label class="block font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Description (Optional)</label>
                              <input
                                type="text"
                                placeholder="e.g. Test divisible by both 3 and 5"
                                value={tc.description || ''}
                                onInput={(e) => updateTestCase(idx(), 'description', e.currentTarget.value)}
                                class="mt-1 w-full rounded border border-white/10 bg-[#151d2d] px-2.5 py-1.5 text-xs text-white outline-none focus:border-garnet transition"
                              />
                            </div>
                            <div class="flex items-center h-[34px]">
                              <label class="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!!tc.hidden}
                                  onChange={(e) => updateTestCase(idx(), 'hidden', e.currentTarget.checked)}
                                  class="rounded bg-[#151d2d] border-white/10 text-garnet focus:ring-garnet/35 w-4 h-4"
                                />
                                <span class="font-mono text-[10px] uppercase tracking-wider text-slate-400">Hidden from student</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <Show when={error()}>
                <div class="rounded-md border border-garnet/30 bg-garnet/[0.08] px-4 py-3 text-sm text-garnet flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span>{error()}</span>
                </div>
              </Show>

              <footer class="border-t border-white/10 pt-4 flex items-center justify-end gap-3 mt-6 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  class="px-4 py-2 text-xs font-mono uppercase tracking-wider text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting() || !problemName().trim() || !problemDescription().trim()}
                  class="inline-flex items-center justify-center gap-2 rounded-md bg-garnet px-5 py-2.5 text-sm font-medium text-white hover:bg-garnet-deep disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting() ? 'Saving…' : (editingLessonId() ? 'Save Changes' : 'Create Lesson')}
                </button>
              </footer>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default CourseDetailPage;

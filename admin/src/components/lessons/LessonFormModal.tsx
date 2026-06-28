import { Component, createSignal, For, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';
import { MonacoEditor } from '../MonacoEditor';
import TestCaseManager, { TestCase } from './TestCaseManager';
import type { GenericId as Id } from 'convex/values';

export interface Lesson {
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

interface Props {
  courseId: Id<'course'>;
  courseLanguage: string;
  editingLesson: Lesson | null;
  initialWeek: number;
  onClose: () => void;
  onSaved: () => void;
}

const LessonFormModal: Component<Props> = (props) => {
  // Lesson Form Signals
  const [week, setWeek] = createSignal(props.editingLesson?.week ?? props.initialWeek);
  const [problemName, setProblemName] = createSignal(props.editingLesson?.problem_name ?? '');
  const [problemDescription, setProblemDescription] = createSignal(props.editingLesson?.problem_description ?? '');
  const [detail, setDetail] = createSignal(props.editingLesson?.detail ?? '');
  const [testCases, setTestCases] = createSignal<TestCase[]>(
    props.editingLesson?.testCases ? JSON.parse(JSON.stringify(props.editingLesson.testCases)) : []
  );
  const [starterCode, setStarterCode] = createSignal(props.editingLesson?.starter_code ?? '');
  const [solutionCode, setSolutionCode] = createSignal(props.editingLesson?.solution_code ?? '');

  // Loading & Error States
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!problemName().trim() || !problemDescription().trim()) {
      setError('Please fill in problem name and summary description.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      course: props.courseId,
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
      const id = props.editingLesson?._id;
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
      props.onSaved();
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the lesson.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-[#1E293B] text-white border border-white/10 rounded-lg max-w-4xl w-full p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
        <header class="border-b border-white/10 pb-4 shrink-0">
          <h3 class="font-display text-xl text-white">
            {props.editingLesson ? 'Edit Lesson' : 'Create Lesson'}
          </h3>
          <p class="mt-1 text-xs text-slate-400 font-sans">
            Set week slot, program specifications, details, starting templates, and automatic grading test cases.
          </p>
        </header>

        <form onsubmit={handleSubmit} class="mt-5 space-y-6 overflow-y-auto flex-1 pr-2">
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
                language={props.courseLanguage}
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
                language={props.courseLanguage}
                onChange={setSolutionCode}
                height="240px"
              />
              <p class="mt-2 text-[11px] text-slate-400 font-sans leading-normal">
                Model answer code. Useful as admin reference and system-level checks.
              </p>
            </div>
          </div>

          {/* Test Cases Sub-section */}
          <TestCaseManager testCases={testCases()} onChange={setTestCases} />

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
              onClick={props.onClose}
              class="px-4 py-2 text-xs font-mono uppercase tracking-wider text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting() || !problemName().trim() || !problemDescription().trim()}
              class="inline-flex items-center justify-center gap-2 rounded-md bg-garnet px-5 py-2.5 text-sm font-medium text-white hover:bg-garnet-deep disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              {submitting() ? 'Saving…' : (props.editingLesson ? 'Save Changes' : 'Create Lesson')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default LessonFormModal;

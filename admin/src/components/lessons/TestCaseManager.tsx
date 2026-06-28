import { Component, Index, Show } from 'solid-js';

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
  hidden?: boolean;
}

interface Props {
  testCases: TestCase[];
  onChange: (testCases: TestCase[]) => void;
}

const TestCaseManager: Component<Props> = (props) => {
  const addTestCase = () => {
    props.onChange([...props.testCases, { input: '', expectedOutput: '', description: '', hidden: false }]);
  };

  const removeTestCase = (index: number) => {
    props.onChange(props.testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: keyof TestCase, value: any) => {
    props.onChange(
      props.testCases.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc))
    );
  };

  return (
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
        when={props.testCases.length > 0}
        fallback={
          <div class="rounded-md border border-dashed border-white/10 p-5 text-center text-xs text-slate-500 font-mono">
            No test cases configured yet. Add test cases to support automatic grading.
          </div>
        }
      >
        <div class="space-y-3.5">
          <Index each={props.testCases}>
            {(tc, idx) => (
              <div class="rounded-md border border-white/10 bg-[#151d2d]/60 p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeTestCase(idx)}
                  class="absolute top-3.5 right-3.5 text-slate-400 hover:text-garnet transition"
                  title="Remove test case"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4.5 h-4.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>

                <div class="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  Test case #{idx + 1}
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Input</label>
                    <textarea
                      rows="1"
                      placeholder="e.g. 15"
                      value={tc().input}
                      onInput={(e) => updateTestCase(idx, 'input', e.currentTarget.value)}
                      class="mt-1 w-full rounded border border-white/10 bg-[#151d2d] px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-garnet transition"
                      required
                    />
                  </div>
                  <div>
                    <label class="block font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Expected Output</label>
                    <textarea
                      rows="1"
                      placeholder="e.g. FizzBuzz"
                      value={tc().expectedOutput}
                      onInput={(e) => updateTestCase(idx, 'expectedOutput', e.currentTarget.value)}
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
                      value={tc().description || ''}
                      onInput={(e) => updateTestCase(idx, 'description', e.currentTarget.value)}
                      class="mt-1 w-full rounded border border-white/10 bg-[#151d2d] px-2.5 py-1.5 text-xs text-white outline-none focus:border-garnet transition"
                    />
                  </div>
                  <div class="flex items-center h-[34px]">
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!tc().hidden}
                        onChange={(e) => updateTestCase(idx, 'hidden', e.currentTarget.checked)}
                        class="rounded bg-[#151d2d] border-white/10 text-garnet focus:ring-garnet/35 w-4 h-4"
                      />
                      <span class="font-mono text-[10px] uppercase tracking-wider text-slate-400">Hidden from student</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </Index>
        </div>
      </Show>
    </div>
  );
};

export default TestCaseManager;

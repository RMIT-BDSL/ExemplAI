import { Component, createSignal, Show } from 'solid-js';
import { convex } from '../../lib/convex';
import { api } from '../../lib/webConvexApi';

interface Props {
  onCreated: () => void;
}

const CreateCodeForm: Component<Props> = (props) => {
  const [code, setCode] = createSignal('');
  const [expiry, setExpiry] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    setCode(result);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!code().trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await convex.mutation(api.invitationCodes.add, {
        code: code().trim().toUpperCase(),
        createdBy: 'admin',
        expiryDate: expiry() || undefined,
      });
      setCode('');
      setExpiry('');
      props.onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />
      <h2 class="text-base font-semibold text-white mb-4">Create New Code</h2>
      <form onSubmit={handleSubmit} class="flex flex-col sm:flex-row gap-3">
        <div class="flex flex-1 rounded-lg overflow-hidden border border-slate-700 focus-within:border-sky-500 transition">
          <input
            type="text"
            placeholder="Code (e.g. ABC12345)"
            value={code()}
            onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
            class="flex-1 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none font-mono"
          />
          <button
            type="button"
            onClick={generateCode}
            class="px-3 bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition border-l border-slate-700"
          >
            Generate
          </button>
        </div>
        <input
          type="date"
          value={expiry()}
          onInput={(e) => setExpiry(e.currentTarget.value)}
          class="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500 transition"
        />
        <button
          type="submit"
          disabled={submitting() || !code().trim()}
          class="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
        >
          {submitting() ? 'Creating…' : 'Create'}
        </button>
      </form>
      <Show when={error()}>
        <p class="mt-3 text-sm text-red-400">{error()}</p>
      </Show>
    </div>
  );
};

export default CreateCodeForm;

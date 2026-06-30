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
    <div class="rounded-md border border-line bg-white">
      <div class="px-6 pt-5 pb-4 border-b border-line">
        <h2 class="font-display text-xl text-ink">Create a code</h2>
        <p class="mt-1 text-sm text-body">
          Enter a code or generate a random one. Expiry date is optional.
        </p>
      </div>

      <form onsubmit={handleSubmit} class="p-6 flex flex-col gap-5 lg:flex-row lg:items-end">
        {/* Code */}
        <div class="flex-1">
          <label for="code" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Code
          </label>
          <div class="mt-2 flex rounded-md border border-line focus-within:border-garnet focus-within:ring-2 focus-within:ring-garnet/15 transition overflow-hidden">
            <input
              id="code"
              type="text"
              placeholder="ABC12345"
              value={code()}
              onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
              class="flex-1 min-w-0 bg-white px-3.5 py-2.5 text-sm font-mono tracking-[0.2em] text-ink placeholder-muted/60 outline-none"
            />
            <button
              type="button"
              onClick={generateCode}
              class="px-4 bg-paper text-body hover:text-ink hover:bg-line/60 text-xs font-mono uppercase tracking-wider transition border-l border-line"
            >
              Generate
            </button>
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label for="expiry" class="block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Expires <span class="normal-case tracking-normal text-muted/70">— optional</span>
          </label>
          <input
            id="expiry"
            type="date"
            value={expiry()}
            onInput={(e) => setExpiry(e.currentTarget.value)}
            class="mt-2 w-full lg:w-44 rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-garnet focus:ring-2 focus:ring-garnet/15 transition"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting() || !code().trim()}
          class="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          {submitting() ? 'Creating…' : 'Create code'}
        </button>
      </form>

      <Show when={error()}>
        <div class="mx-6 mb-6 -mt-1 flex items-start gap-2 rounded-md border border-garnet/30 bg-garnet/[0.05] px-4 py-3 text-sm text-garnet">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="w-4 h-4 mt-0.5 shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{error()}</span>
        </div>
      </Show>
    </div>
  );
};

export default CreateCodeForm;

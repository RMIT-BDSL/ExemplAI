import { Component, createResource, Show } from 'solid-js';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';
import CreateCodeForm from '../components/invitation-codes/CreateCodeForm';
import InvitationCodesTable from '../components/invitation-codes/InvitationCodesTable';
import type { InvitationCode } from '../components/invitation-codes/types';

async function fetchCodes(): Promise<InvitationCode[]> {
  return await convex.query(api.invitationCodes.listAll, {});
}

const InvitationCodesPage: Component = () => {
  const [codes, { refetch }] = createResource<InvitationCode[]>(fetchCodes);

  return (
    <div class="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12 space-y-7">
      <header class="border-b border-line pb-7">
        <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Student access</p>
        <h1 class="mt-3 font-display text-[30px] sm:text-[36px] leading-tight tracking-[-0.01em] text-ink">
          Invitation codes
        </h1>
        <p class="mt-2 max-w-xl text-[15px] text-body">
          Create single-use codes and manage who can sign up. Each code works once.
        </p>
      </header>

      <CreateCodeForm onCreated={refetch} />

      <Show when={codes.error}>
        <div class="rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">
          Failed to load codes. Check your connection (VITE_CONVEX_URL) and refresh.
        </div>
      </Show>

      <Show
        when={!codes.loading}
        fallback={
          <div class="rounded-md border border-line bg-white px-6 py-16 text-center text-sm text-muted">
            Loading codes…
          </div>
        }
      >
        <Show when={codes()}>
          <InvitationCodesTable data={codes()!} onRefetch={refetch} />
        </Show>
      </Show>
    </div>
  );
};

export default InvitationCodesPage;

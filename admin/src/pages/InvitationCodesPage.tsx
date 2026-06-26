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
    <div class="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">Invitation Codes</h1>
        <p class="text-sm text-slate-400 mt-1">Create and manage single-use invitation codes for student access.</p>
      </div>

      <CreateCodeForm onCreated={refetch} />

      <Show when={codes.error}>
        <div class="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-400">
          Failed to load codes. Check VITE_CONVEX_URL.
        </div>
      </Show>

      <Show when={!codes.loading} fallback={
        <div class="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-12 text-center text-slate-500 text-sm">
          Loading…
        </div>
      }>
        <Show when={codes()}>
          <InvitationCodesTable data={codes()!} onRefetch={refetch} />
        </Show>
      </Show>
    </div>
  );
};

export default InvitationCodesPage;

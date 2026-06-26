import { Component, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../context/AuthContext';
import { convex } from '../lib/convex';
import { api } from '../lib/webConvexApi';
import type { InvitationCode } from '../components/invitation-codes/types';

async function fetchCodes(): Promise<InvitationCode[]> {
  return await convex.query(api.invitationCodes.listAll, {});
}

function isExpired(c: InvitationCode) {
  if (!c.expiryDate) return false;
  const d = new Date(c.expiryDate);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

function isActive(c: InvitationCode) {
  return c.isValid && c.usesCount < c.quantity && !isExpired(c);
}

const DashboardPage: Component = () => {
  const { user } = useAuth();
  const [codes] = createResource<InvitationCode[]>(fetchCodes);

  const stats = () => {
    const list = codes() ?? [];
    const active = list.filter(isActive).length;
    const redeemed = list.reduce((sum, c) => sum + c.usesCount, 0);
    return {
      total: list.length,
      active,
      redeemed,
      inactive: list.length - active,
    };
  };

  const firstName = () => {
    const n = user()?.name?.trim();
    if (n) return n.split(' ')[0];
    return user()?.email?.split('@')[0] ?? 'there';
  };

  const ledger = () => [
    { label: 'Total codes', value: stats().total, note: 'created' },
    { label: 'Active', value: stats().active, note: 'ready to use', tone: 'ivy' as const },
    { label: 'Students joined', value: stats().redeemed, note: 'total sign-ups' },
    { label: 'Inactive', value: stats().inactive, note: 'expired or used' },
  ];

  return (
    <div class="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10 py-9 sm:py-12">
      {/* Ledger header */}
      <header class="border-b border-line pb-8">
        <p class="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          Dashboard
        </p>
        <h1 class="mt-3 font-display text-[34px] sm:text-[42px] leading-[1.05] tracking-[-0.01em] text-ink">
          Welcome back, {firstName()}.
        </h1>
        <p class="mt-2 max-w-xl text-[15px] text-body">
          Manage student access and invitation codes for ExemplAI.
        </p>
      </header>

      <Show when={codes.error}>
        <div class="mt-6 rounded-md border border-brass/30 bg-brass/[0.06] px-4 py-3 text-sm text-brass">
          Couldn't load your stats just now. Check your connection and refresh.
        </div>
      </Show>

      {/* Ledger strip — serif numerals, hairline dividers */}
      <section class="mt-8 grid grid-cols-2 lg:grid-cols-4 border border-line rounded-md bg-white overflow-hidden">
        <For each={ledger()}>
          {(item, i) => (
            <div
              class="px-5 py-6 border-line"
              classList={{
                'border-b lg:border-b-0': i() < 2,
                'border-r': i() % 2 === 0,
                'lg:border-r': i() < 3,
              }}
            >
              <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{item.label}</p>
              <Show
                when={!codes.loading}
                fallback={<div class="mt-2 h-9 w-12 rounded bg-line/70 animate-pulse" />}
              >
                <p
                  class="mt-1.5 font-display text-[40px] leading-none tabular-nums"
                  classList={{ 'text-ivy': item.tone === 'ivy', 'text-ink': item.tone !== 'ivy' }}
                >
                  {item.value}
                </p>
              </Show>
              <p class="mt-2 text-xs text-muted">{item.note}</p>
            </div>
          )}
        </For>
      </section>

      {/* Lower row */}
      <div class="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Primary task */}
        <div class="lg:col-span-3 rounded-md border border-line bg-white p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h2 class="font-display text-xl text-ink">Create an invitation code</h2>
            <p class="mt-1.5 text-sm text-body max-w-sm">
              Generate a single-use code and share it with a student so they can sign up.
            </p>
          </div>
          <A
            href="/invitation-codes"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-garnet px-5 py-2.5 text-sm font-medium text-paper hover:bg-garnet-deep transition-colors"
          >
            Manage codes
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </A>
        </div>

        {/* Account */}
        <div class="lg:col-span-2 rounded-md border border-line bg-white p-7">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Signed in as</h2>
          <dl class="mt-4 space-y-3.5">
            <div>
              <dt class="text-xs text-muted">Email</dt>
              <dd class="mt-0.5 font-mono text-[13px] text-ink break-all">{user()?.email}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Name</dt>
              <dd class="mt-0.5 text-sm text-ink">{user()?.name || 'Not set'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

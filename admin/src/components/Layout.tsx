import { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../context/AuthContext';

const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
  </svg>
);

const CodesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
  </svg>
);

const CoursesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-[18px] h-[18px]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </svg>
);

const SignOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
  </svg>
);

// Garnet seal with a Fraunces monogram — the institutional mark.
const Seal = () => (
  <span class="grid place-items-center w-8 h-8 rounded-[5px] bg-garnet text-paper font-display text-lg leading-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
    E
  </span>
);

const Wordmark = (props: { onInk?: boolean }) => (
  <div class="flex items-center gap-2.5">
    <Seal />
    <div class="leading-tight">
      <p class={`font-display text-[17px] tracking-tight ${props.onInk ? 'text-paper' : 'text-ink'}`}>ExemplAI</p>
      <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Admin</p>
    </div>
  </div>
);

const NavLink: Component<{ href: string; end?: boolean; label: string; icon: JSX.Element }> = (props) => (
  <A
    href={props.href}
    end={props.end}
    class="group relative flex items-center gap-3 pl-4 pr-3 py-2.5 text-sm font-medium text-paper/55 hover:text-paper hover:bg-white/[0.04] rounded-r-md transition-colors"
    activeClass="!text-paper bg-white/[0.06] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-garnet"
  >
    {props.icon}
    {props.label}
  </A>
);

const Layout: Component<{ children?: JSX.Element }> = (props) => {
  const { signOut, user } = useAuth();

  const displayName = () => user()?.name?.trim() || 'Administrator';
  const initial = () => (user()?.name?.trim() || user()?.email || '?').charAt(0).toUpperCase();

  return (
    <div class="h-screen flex bg-paper overflow-hidden">
      {/* Spine (desktop) */}
      <aside class="hidden md:flex md:flex-col w-60 shrink-0 bg-ink text-paper">
        <div class="px-4 h-[72px] flex items-center border-b border-white/[0.06]">
          <Wordmark onInk />
        </div>
        <div class="flex-1 px-2 py-5">
          <p class="px-4 mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/35">Menu</p>
          <nav class="space-y-0.5">
            <NavLink href="/" end label="Dashboard" icon={<DashboardIcon />} />
            <NavLink href="/courses" label="Courses" icon={<CoursesIcon />} />
            <NavLink href="/invitation-codes" label="Invitation Codes" icon={<CodesIcon />} />
          </nav>
        </div>
        <div class="p-3 border-t border-white/[0.06]">
          <div class="flex items-center gap-3 px-2 py-2">
            <div class="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-white/[0.08] text-paper font-display text-base">
              {initial()}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-paper truncate">{displayName()}</p>
              <p class="font-mono text-[11px] text-paper/45 truncate">{user()?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            class="mt-1.5 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-paper/70 border border-white/10 hover:bg-white/[0.05] hover:text-paper transition-colors"
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar (mobile) */}
        <header class="md:hidden bg-ink text-paper">
          <div class="flex items-center justify-between px-4 h-14">
            <Wordmark onInk />
            <button
              onClick={signOut}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-paper/75 border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <SignOutIcon />
              Sign out
            </button>
          </div>
          <div class="px-1.5 pb-1.5 flex gap-0.5 overflow-x-auto">
            <NavLink href="/" end label="Dashboard" icon={<DashboardIcon />} />
            <NavLink href="/courses" label="Courses" icon={<CoursesIcon />} />
            <NavLink href="/invitation-codes" label="Codes" icon={<CodesIcon />} />
          </div>
        </header>

        <main class="flex-1 overflow-y-auto">{props.children}</main>
      </div>
    </div>
  );
};

export default Layout;

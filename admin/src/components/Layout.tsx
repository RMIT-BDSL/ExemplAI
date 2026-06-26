import { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../context/AuthContext';

const Layout: Component<{ children?: JSX.Element }> = (props) => {
  const { signOut, user } = useAuth();

  return (
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header class="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-8">
          <span class="text-lg font-bold tracking-wider text-white">ExemplAI Admin</span>
          <nav class="flex items-center space-x-6">
            <A href="/" end class="text-sm font-medium text-slate-400 hover:text-white transition-colors" activeClass="text-white font-semibold">
              Dashboard
            </A>
            <A href="/invitation-codes" class="text-sm font-medium text-slate-400 hover:text-white transition-colors" activeClass="text-white font-semibold">
              Invitation Codes
            </A>
          </nav>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-xs text-slate-500 font-mono">{user()?.email}</span>
          <button 
            onClick={signOut}
            class="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main class="flex-1">
        {props.children}
      </main>
    </div>
  );
};

export default Layout;

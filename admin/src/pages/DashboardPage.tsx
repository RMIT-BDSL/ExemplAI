import { Component } from 'solid-js';
import { useAuth } from '../context/AuthContext';

const DashboardPage: Component = () => {
  const { user } = useAuth();

  return (
    <div class="max-w-7xl mx-auto px-6 py-12">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />

        <div class="flex items-center space-x-4 mb-6">
          <div class="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-white">Authenticated Successfully</h1>
            <p class="text-sm text-slate-400">Welcome back to the ExemplAI Admin Workspace</p>
          </div>
        </div>

        <div class="border-t border-slate-800 pt-6 mt-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-slate-950/50 border border-slate-800 p-5 rounded-xl">
              <p class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Signed In As</p>
              <p class="text-white font-mono text-sm">{user()?.email}</p>
            </div>
            <div class="bg-slate-950/50 border border-slate-800 p-5 rounded-xl">
              <p class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Display Name</p>
              <p class="text-white font-mono text-sm">{user()?.name || 'No Display Name'}</p>
            </div>
          </div>
          <div class="bg-slate-950/30 border border-slate-800/50 p-4 rounded-xl text-sm text-slate-400">
            <p>Your session is managed securely via Convex + Better Auth client integration.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

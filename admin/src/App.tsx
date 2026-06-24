import { Component, Show } from 'solid-js';
import { Router, Route, Navigate } from '@solidjs/router';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Loading from './components/Loading';

const Dashboard: Component = () => {
  const { user, signOut } = useAuth();
  
  return (
    <div class="min-h-screen bg-slate-950 text-white font-sans selection:bg-sky-500 selection:text-white">
      {/* Premium Navbar */}
      <nav class="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-lg bg-sky-600/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
            </svg>
          </div>
          <span class="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">ExemplAI Admin</span>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-right hidden sm:block">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Administrator</p>
            <p class="text-sm text-slate-300">{user()?.email}</p>
          </div>
          <button 
            onClick={signOut}
            class="px-4 py-2 border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg text-sm transition font-medium flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main class="max-w-7xl mx-auto px-6 py-12">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl relative overflow-hidden">
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500"></div>
          
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
      </main>
    </div>
  );
};

const ProtectedRoute: Component<{ children?: any }> = (props) => {
  const { user, loading } = useAuth();
  
  return (
    <Show
      when={!loading()}
      fallback={<Loading />}
    >
      <Show when={user()} fallback={<Navigate href="/login" />}>
        {props.children}
      </Show>
    </Show>
  );
};

const App: Component = () => {
  return (
    <AuthProvider>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/" component={ProtectedRoute}>
          <Route path="" component={Dashboard} />
        </Route>
        <Route path="*" component={() => <Navigate href="/" />} />
      </Router>
    </AuthProvider>
  );
};

export default App;

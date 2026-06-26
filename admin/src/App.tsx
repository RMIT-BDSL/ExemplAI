import { Component, Show } from 'solid-js';
import { Router, Route, Navigate, A } from '@solidjs/router';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Loading from './components/Loading';
import InvitationCodesPage from './pages/InvitationCodesPage';
import DashboardPage from './pages/DashboardPage';

const Layout: Component<{ children?: any }> = (props) => {
  const { user, signOut } = useAuth();

  return (
    <div class="min-h-screen bg-slate-950 text-white font-sans selection:bg-sky-500 selection:text-white">
      <nav class="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-6">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg bg-sky-600/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <span class="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">ExemplAI Admin</span>
          </div>
          <div class="hidden sm:flex items-center gap-1">
            <A href="/" end class="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition" activeClass="text-white bg-slate-800">
              Dashboard
            </A>
            <A href="/invitation-codes" class="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition" activeClass="text-white bg-slate-800">
              Invitations
            </A>
          </div>
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
      <main>{props.children}</main>
    </div>
  );
};

const ProtectedRoute: Component<{ children?: any }> = (props) => {
  const { user, loading } = useAuth();

  return (
    <Show when={!loading()} fallback={<Loading />}>
      <Show when={user()} fallback={<Navigate href="/login" />}>
        <Layout>{props.children}</Layout>
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
          <Route path="" component={DashboardPage} />
          <Route path="invitation-codes" component={InvitationCodesPage} />
        </Route>
        <Route path="*" component={() => <Navigate href="/" />} />
      </Router>
    </AuthProvider>
  );
};

export default App;

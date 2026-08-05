import { Component, Show } from 'solid-js';
import { Router, Route, Navigate, A } from '@solidjs/router';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Loading from './components/Loading';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import InvitationCodesPage from './pages/InvitationCodesPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import ReleaseNotesPage from './pages/ReleaseNotesPage';

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
          <Route path="courses" component={CoursesPage} />
          <Route path="courses/:id" component={CourseDetailPage} />
          <Route path="release-notes" component={ReleaseNotesPage} />
        </Route>
        <Route path="*" component={() => <Navigate href="/" />} />
      </Router>
    </AuthProvider>
  );
};

export default App;

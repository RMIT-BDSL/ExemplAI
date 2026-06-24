import { createContext, useContext, JSX } from "solid-js";
import { useSession, authClient } from "../lib/auth-client";

interface AuthContextType {
  user: () => any;
  loading: () => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
  const session = useSession();

  const user = () => session()?.data?.user || null;
  const loading = () => session()?.isPending ?? false;

  const signOut = async () => {
    await authClient.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

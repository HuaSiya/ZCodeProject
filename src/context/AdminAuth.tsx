import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";

interface AdminAuthValue {
  loading: boolean;
  authenticated: boolean;
  login: (passcode: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const session = await api.admin.session();
      setAuthenticated(session.authenticated);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.admin
      .session()
      .then((session) => {
        if (active) {
          setAuthenticated(session.authenticated);
        }
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (passcode: string) => {
    await api.admin.login(passcode);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await api.admin.logout();
    setAuthenticated(false);
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({ loading, authenticated, login, logout, refresh }),
    [loading, authenticated, login, logout, refresh],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}

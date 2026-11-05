import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { client, TOKEN_KEY } from "../api/client";
import type { User, AuthResponse } from "../types/auth";
interface Auth {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}
export const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const query = useQueryClient();
  const logout = useCallback(() => {
    generation.current++;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLoading(false);
    query.clear();
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    client
      .get<{ user: User }>("/auth/me", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setUser(data.user);
      })
      .catch(() => {
        if (!controller.signal.aborted) logout();
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [logout]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) logout();
    };
    window.addEventListener("auth-expired", logout);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-expired", logout);
      window.removeEventListener("storage", sync);
    };
  }, [logout]);
  async function authenticate(path: string, body: object) {
    const current = ++generation.current;
    const { data } = await client.post<AuthResponse>(path, body);
    if (current !== generation.current) return;
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    query.clear();
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        logout,
        login: (email, password) =>
          authenticate("/auth/login", { email, password }),
        register: (name, email, password) =>
          authenticate("/auth/register", { name, email, password }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

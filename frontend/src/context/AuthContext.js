import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, getMe, logoutApi, invalidateAllCaches, getDashboard, getPublicSettings } from "@/api";
import { setSessionLoginTime, clearSession } from "@/lib/security";
import { SESSION } from "@/lib/constants";

const prefetchCritical = () => {
  getDashboard().catch(() => {});
  getPublicSettings().catch(() => {});
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem(SESSION.TOKEN_KEY);
    if (token) {
      getMe()
        .then((data) => { setUser(data); prefetchCritical(); })
        .catch(() => {
          clearSession();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      invalidateAllCaches();
      clearSession();
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  // Session timeout check
  useEffect(() => {
    if (!user) return;
    
    const checkSession = () => {
      const token = sessionStorage.getItem(SESSION.TOKEN_KEY);
      if (!token) {
        window.dispatchEvent(new CustomEvent("auth:expired"));
        return;
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    sessionStorage.setItem(SESSION.TOKEN_KEY, res.access_token);
    setSessionLoginTime();
    setSessionExpired(false);
    setUser(res.user);
    prefetchCritical();
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* network failure must not prevent local logout */ }
    clearSession();
    invalidateAllCaches();
    setUser(null);
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, sessionExpired, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

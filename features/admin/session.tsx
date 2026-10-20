"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { apiBase, apiRequest } from "@/services/pelayanan";
import type { StaffLoginRequest, StaffLoginResponse, StaffProfile } from "@/types/pelayanan";
import { adminFetch, adminRequest, AdminUnauthorizedError, SESSION_EXPIRED_MESSAGE } from "./api";

/** sessionStorage: hilang saat tab ditutup. Jangan pindahkan ke localStorage atau URL. */
const STORAGE_KEY = "watuagung-staff-token";

const profileSchema = z.object({
  name: z.string(),
  username: z.string().nullable(),
  role: z.enum(["staff", "village_head", "admin", "rt_head", "rw_head"]),
  rt: z.string().nullable(),
  rw: z.string().nullable(),
});

export type AdminSessionStatus = "checking" | "signed-out" | "signed-in" | "unreachable";

type State = { status: AdminSessionStatus; token: string | null; user: StaffProfile | null; notice: string };

type AdminSession = State & {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

function readToken() {
  try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Penyimpanan diblokir: sesi tetap berjalan di memori sampai halaman dimuat ulang.
  }
}
async function fetchProfile(token: string) {
  return profileSchema.parse(await adminFetch<unknown>("/staff/me", token));
}

const signedOut = (notice = ""): State => ({ status: "signed-out", token: null, user: null, notice });

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: apiBase ? "checking" : "signed-out", token: null, user: null, notice: "" });
  // Token terkini untuk membandingkan respons 401 yang datang terlambat.
  const tokenRef = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const clear = useCallback((notice = "") => {
    tokenRef.current = null;
    writeToken(null);
    setState(signedOut(notice));
  }, []);

  // Pulihkan sesi dari tab ini, lalu validasi ke server sebelum isi admin tampil.
  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    void (async () => {
      const stored = readToken();
      if (!stored) {
        await Promise.resolve();
        if (!cancelled) clear();
        return;
      }
      try {
        const user = await fetchProfile(stored);
        if (cancelled) return;
        tokenRef.current = stored;
        setState({ status: "signed-in", token: stored, user, notice: "" });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AdminUnauthorizedError) clear(SESSION_EXPIRED_MESSAGE);
        else setState({ status: "unreachable", token: null, user: null, notice: error instanceof Error ? error.message : "" });
      }
    })();
    return () => { cancelled = true; };
  }, [attempt, clear]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: "checking" }));
    setAttempt((n) => n + 1);
  }, []);

  const expire = useCallback((token: string) => {
    // Abaikan 401 dari token lama (misalnya permintaan yang selesai setelah keluar).
    if (tokenRef.current !== token) return;
    clear(SESSION_EXPIRED_MESSAGE);
  }, [clear]);

  const login = useCallback(async (username: string, password: string) => {
    const credentials: StaffLoginRequest = { username: username.trim(), password };
    const result = await apiRequest<StaffLoginResponse>("/staff/login", { method: "POST", body: JSON.stringify(credentials) });
    const user = await fetchProfile(result.token);
    tokenRef.current = result.token;
    writeToken(result.token);
    setState({ status: "signed-in", token: result.token, user, notice: "" });
  }, []);

  const logout = useCallback(async () => {
    const token = tokenRef.current ?? readToken();
    try {
      if (token) await adminFetch("/staff/logout", token, { method: "POST" });
    } catch {
      // Sesi lokal tetap dihapus walaupun server tidak terjangkau.
    } finally {
      clear();
    }
  }, [clear]);

  const request = useCallback(<T,>(path: string, options?: RequestInit) =>
    adminRequest<T>({ token: tokenRef.current ?? "", onUnauthorized: expire }, path, options), [expire]);

  const value = useMemo<AdminSession>(() => ({ ...state, login, logout, retry, request }), [state, login, logout, retry, request]);
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error("useAdminSession harus dipakai di dalam AdminSessionProvider.");
  return session;
}

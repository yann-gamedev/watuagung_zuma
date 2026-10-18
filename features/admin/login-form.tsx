"use client";
import { useState } from "react";
import { useAdminSession } from "./session";

export function AdminLoginForm() {
  const { login, notice } = useAdminSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await login(username, password);
    } catch (err) {
      setPassword("");
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally { setBusy(false); }
  }

  return (
    <div className="center-card admin-login">
      <h1>Masuk sebagai petugas</h1>
      <p>Gunakan akun yang dibuat oleh administrator desa.</p>
      {notice && !error && <p className="notice admin-session-notice" role="status">{notice}</p>}
      <form onSubmit={submit} className="fields">
        <label htmlFor="staff-username">Username</label>
        <input id="staff-username" className="search-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} required autoComplete="username" autoCapitalize="none" spellCheck={false} />
        <label htmlFor="staff-password">Kata sandi</label>
        <input id="staff-password" className="search-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <button id="staff-login" className="btn" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
      </form>
      {error && <p className="error-box" role="alert">{error}</p>}
    </div>
  );
}

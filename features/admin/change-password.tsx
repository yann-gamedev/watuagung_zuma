"use client";
import { useId, useState } from "react";
import { useAdminSession } from "./session";

/** Dipakai layar wajib ganti kata sandi dan dialog menu akun. */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { changePassword } = useAdminSession();
  const id = useId();
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 10) return setError("Kata sandi baru minimal 10 karakter.");
    if (password !== confirm) return setError("Kata sandi baru dan ulangannya tidak sama.");
    setBusy(true);
    try {
      await changePassword(oldPassword, password);
      setOldPassword(""); setPassword(""); setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kata sandi belum dapat diubah.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <p className="notice" role="status">Kata sandi diperbarui.</p>
        {onDone && <button type="button" className="btn mt-4" onClick={onDone}>Selesai</button>}
      </div>
    );
  }

  return (
    <form className="fields" onSubmit={submit}>
      <div className="field wide">
        <label htmlFor={`${id}-old`}>Kata sandi lama</label>
        <input id={`${id}-old`} type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      <div className="field wide">
        <label htmlFor={`${id}-new`}>Kata sandi baru (minimal 10 karakter)</label>
        <input id={`${id}-new`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required />
      </div>
      <div className="field wide">
        <label htmlFor={`${id}-confirm`}>Ulangi kata sandi baru</label>
        <input id={`${id}-confirm`} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={10} required />
      </div>
      {error && <div className="field wide"><p className="error-box" role="alert">{error}</p></div>}
      <div className="field wide">
        <button className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan kata sandi baru"}</button>
      </div>
    </form>
  );
}

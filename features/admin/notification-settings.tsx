"use client";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { z } from "zod";
import type { StaffApprovalPinInput, StaffNotificationSettings } from "@/types/pelayanan";
import { useAdminSession } from "./session";
import styles from "./notification-settings.module.css";

const settingsSchema = z.object({
  notification_email: z.string().nullable(),
  notification_email_verified: z.boolean(),
  approval_by_email_available: z.boolean(),
  approval_pin_set: z.boolean(),
  approval_pin_set_at: z.string().nullable(),
  approval_by_email_active: z.boolean(),
});

/**
 * Menu Akun → Notifikasi email (semua peran panel). Bagian PIN dan persetujuan lewat email hanya untuk Kepala Desa;
 * server tetap menolak PIN untuk peran lain.
 */
export function NotificationSettings() {
  const { request } = useAdminSession();
  const id = useId();
  const [settings, setSettings] = useState<StaffNotificationSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinNotice, setPinNotice] = useState("");
  const [pinError, setPinError] = useState("");

  const apply = useCallback((data: unknown) => {
    const parsed = settingsSchema.parse(data);
    setSettings(parsed);
    setEmail(parsed.notification_email ?? "");
    return parsed;
  }, []);

  useEffect(() => {
    let active = true;
    request<unknown>("/staff/me/notifications")
      .then((data) => { if (active) apply(data); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "Pengaturan belum dapat dimuat."); });
    return () => { active = false; };
  }, [request, apply]);

  async function saveEmail(event: FormEvent, value: string | null = email.trim() || null) {
    event.preventDefault();
    if (emailBusy) return;
    setEmailBusy(true);
    setEmailError("");
    setEmailNotice("");
    try {
      const next = apply(await request<unknown>("/staff/me/notifications", { method: "PUT", body: JSON.stringify({ email: value }) }));
      setEmailNotice(!next.notification_email
        ? "Email notifikasi dihapus. Notifikasi dan persetujuan lewat email tidak dikirim."
        : next.notification_email_verified
          ? "Email tidak berubah dan sudah terverifikasi."
          : `Tautan verifikasi terkirim ke ${next.notification_email}. Buka email itu dan tekan Konfirmasi email (berlaku 24 jam). Periksa juga folder spam.`);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Email belum dapat disimpan.");
    } finally { setEmailBusy(false); }
  }

  async function savePin(event: FormEvent) {
    event.preventDefault();
    if (pinBusy) return;
    setPinError("");
    setPinNotice("");
    if (!/^[0-9]{6}$/.test(pin)) return setPinError("PIN harus 6 digit angka.");
    if (pin !== pinConfirm) return setPinError("Konfirmasi PIN tidak sama.");
    if (!password) return setPinError("Kata sandi akun wajib diisi.");
    setPinBusy(true);
    try {
      const body: StaffApprovalPinInput = { pin, pin_confirmation: pinConfirm, password };
      apply(await request<unknown>("/staff/me/notifications/pin", { method: "PUT", body: JSON.stringify(body) }));
      setPin(""); setPinConfirm(""); setPassword("");
      setPinNotice("PIN persetujuan disimpan.");
    } catch (error) {
      setPinError(error instanceof Error ? error.message : "PIN belum dapat disimpan.");
    } finally { setPinBusy(false); }
  }

  if (loadError) return <p className="error-box" role="alert">{loadError}</p>;
  if (!settings) return <p role="status">Memuat pengaturan…</p>;
  const verified = settings.notification_email_verified;

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby={`${id}-email-title`}>
        <h2 id={`${id}-email-title`}>Email notifikasi</h2>
        <p>Email untuk notifikasi akun ini. Alamat harus dikonfirmasi lewat tautan yang dikirim ke email tersebut.</p>
        {settings.notification_email && (
          <p className={`${styles.status} ${verified ? styles.ok : styles.pending}`}>
            {verified ? <CheckCircle2 size={22} aria-hidden="true" /> : <Clock3 size={22} aria-hidden="true" />}
            {verified ? "Terverifikasi" : "Belum diverifikasi"}
          </p>
        )}
        <form className={styles.form} onSubmit={(event) => void saveEmail(event)}>
          <div>
            <label htmlFor={`${id}-email`}>Alamat email</label>
            <input id={`${id}-email`} type="email" value={email} maxLength={120} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </div>
          {emailNotice && <p className="notice" role="status">{emailNotice}</p>}
          {emailError && <p className="error-box" role="alert">{emailError}</p>}
          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={emailBusy}>{emailBusy ? "Menyimpan…" : settings.notification_email && !verified && email.trim() === settings.notification_email ? "Kirim ulang tautan verifikasi" : "Simpan email"}</button>
            {settings.notification_email && <button className="btn btn-secondary" type="button" disabled={emailBusy} onClick={(event) => void saveEmail(event, null)}>Hapus email</button>}
          </div>
        </form>
      </section>

      {settings.approval_by_email_available && (
        <section className={styles.card} aria-labelledby={`${id}-pin-title`}>
          <h2 id={`${id}-pin-title`}>Persetujuan lewat email</h2>
          <p>Saat permohonan menunggu persetujuan, Anda menerima email berisi tautan ke halaman konfirmasi. <strong>PIN diminta setiap menyetujui lewat email. Jangan bagikan.</strong></p>
          <p className={`${styles.status} ${settings.approval_by_email_active ? styles.ok : styles.pending}`}>
            {settings.approval_by_email_active ? <CheckCircle2 size={22} aria-hidden="true" /> : <Clock3 size={22} aria-hidden="true" />}
            {settings.approval_by_email_active ? "Aktif" : !verified ? "Belum aktif: konfirmasi email dulu" : "Belum aktif: atur PIN"}
          </p>
          <form className={styles.form} onSubmit={(event) => void savePin(event)}>
            <div>
              <label htmlFor={`${id}-pin`}>{settings.approval_pin_set ? "PIN baru (6 digit)" : "PIN (6 digit)"}</label>
              <input id={`${id}-pin`} className={styles.pin} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby={`${id}-pin-help`} />
              <p id={`${id}-pin-help`} className="mt-2">Hindari angka sama atau berurutan seperti 111111 atau 123456.</p>
            </div>
            <div>
              <label htmlFor={`${id}-pin-confirm`}>Ulangi PIN</label>
              <input id={`${id}-pin-confirm`} className={styles.pin} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <div>
              <label htmlFor={`${id}-password`}>Kata sandi akun</label>
              <input id={`${id}-password`} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {pinNotice && <p className="notice" role="status">{pinNotice}</p>}
            {pinError && <p className="error-box" role="alert">{pinError}</p>}
            <div className={styles.actions}>
              <button className="btn" type="submit" disabled={pinBusy}>{pinBusy ? "Menyimpan…" : settings.approval_pin_set ? "Ganti PIN" : "Simpan PIN"}</button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

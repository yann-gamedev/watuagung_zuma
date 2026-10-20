"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Copy, Plus, RefreshCw, RotateCcw } from "lucide-react";
import type { StaffAccountWarning, StaffRole, StaffUser, StaffUsersResponse } from "@/types/pelayanan";
import { useAdminSession } from "./session";
import styles from "./accounts.module.css";

const roleLabels: Record<StaffRole, string> = {
  staff: "Petugas",
  village_head: "Kepala Desa",
  admin: "Admin",
  rt_head: "Ketua RT",
  rw_head: "Ketua RW",
};
const roles = Object.keys(roleLabels) as StaffRole[];

type Editor = { mode: "create" } | { mode: "edit"; user: StaffUser } | { mode: "reset"; user: StaffUser };
type AccountValues = { name: string; username: string; role: StaffRole; password: string; rt: string | null; rw: string | null };

/** Halaman hanya dirender untuk admin; server tetap memeriksa ulang setiap permintaan. */
export function AccountsManager() {
  const { user } = useAdminSession();
  if (user?.role !== "admin") {
    return (
      <div className={styles.denied}>
        <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>
        <Link className="btn btn-secondary" href="/admin/">Kembali ke Dashboard</Link>
      </div>
    );
  }
  return <Accounts />;
}

function Accounts() {
  const { user: currentUser, request } = useAdminSession();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [warnings, setWarnings] = useState<StaffAccountWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [roleFilter, setRoleFilter] = useState<StaffRole | "">("");
  const [rwFilter, setRwFilter] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [temporary, setTemporary] = useState<{ name: string; password: string } | null>(null);

  const reload = () => setAttempt((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    request<StaffUsersResponse>("/staff/users")
      .then((result) => {
        if (cancelled) return;
        setUsers(result.data);
        setWarnings(result.warnings);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Daftar akun belum dapat dimuat.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [request, attempt]);

  const rwOptions = Array.from(new Set(users.map((account) => account.rw).filter((rw): rw is string => Boolean(rw)))).sort();
  const filtered = users.filter((account) =>
    (!roleFilter || account.role === roleFilter) && (!rwFilter || account.rw === rwFilter));

  async function create(values: AccountValues) {
    await request("/staff/users", { method: "POST", body: JSON.stringify(values) });
    setEditor(null);
    setTemporary({ name: values.name, password: values.password });
    reload();
  }

  async function update(target: StaffUser, values: AccountValues) {
    await request(`/staff/users/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: values.name,
        role: values.role,
        is_active: target.is_active,
        rt: values.rt,
        rw: values.rw,
      }),
    });
    setEditor(null);
    reload();
  }

  async function reset(target: StaffUser, password: string) {
    await request(`/staff/users/${target.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setEditor(null);
    setTemporary({ name: target.name, password });
    reload();
  }

  async function toggle(target: StaffUser) {
    const next = !target.is_active;
    if (!window.confirm(`${next ? "Aktifkan" : "Nonaktifkan"} akun ${target.name}?`)) return;
    setError("");
    try {
      await request(`/staff/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: target.name,
          role: target.role,
          is_active: next,
          rt: target.rt,
          rw: target.rw,
        }),
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status akun belum dapat diubah.");
    }
  }

  return (
    <div className={styles.page}>
      <div className="admin-page-intro">
        <p>Buat dan kelola akun petugas. Kata sandi sementara wajib diganti saat petugas pertama kali masuk.</p>
        <button type="button" className="btn" onClick={() => setEditor({ mode: "create" })}>
          <Plus size={22} aria-hidden="true" /> Tambah akun
        </button>
      </div>

      {warnings.length > 0 && (
        <section className={styles.warning} aria-labelledby="account-warnings">
          <h2 id="account-warnings">Wilayah tanpa ketua aktif</h2>
          <ul>
            {warnings.map((warning) => (
              <li key={`${warning.role}-${warning.rt ?? ""}-${warning.rw}`}>
                {warning.role === "rt_head" ? `RT ${warning.rt} / RW ${warning.rw}` : `RW ${warning.rw}`} belum punya akun {warning.role === "rt_head" ? "Ketua RT" : "Ketua RW"} aktif — {warning.pending} permohonan tertahan.
              </li>
            ))}
          </ul>
          <p>Nonaktifkan akun lama sebelum membuat akun ketua pengganti.</p>
        </section>
      )}

      <section className={styles.panel} aria-labelledby="accounts-title">
        <div className={styles.panelHead}>
          <h2 id="accounts-title">Daftar akun</h2>
          <button type="button" className="btn btn-secondary" onClick={reload}>
            <RefreshCw size={22} aria-hidden="true" /> Muat ulang
          </button>
        </div>

        <div className={styles.filters}>
          <div className={styles.field}>
            <label htmlFor="account-role-filter">Peran</label>
            <select id="account-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as StaffRole | "")}>
              <option value="">Semua peran</option>
              {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="account-rw-filter">RW</label>
            <select id="account-rw-filter" value={rwFilter} onChange={(event) => setRwFilter(event.target.value)}>
              <option value="">Semua RW</option>
              {rwOptions.map((rw) => <option key={rw} value={rw}>RW {rw}</option>)}
            </select>
          </div>
        </div>

        {loading ? <p className={styles.message} role="status">Memuat akun...</p>
          : error ? <p className="error-box" role="alert">{error}</p>
          : filtered.length === 0 ? <p className={styles.message}>Belum ada akun yang cocok dengan filter.</p>
          : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col">Username</th>
                    <th scope="col">Peran</th>
                    <th scope="col">Wilayah</th>
                    <th scope="col">Status</th>
                    <th scope="col">Login terakhir</th>
                    <th scope="col">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((account) => {
                    const self = account.id === currentUser?.id;
                    return (
                      <tr key={account.id}>
                        <td>{account.name}</td>
                        <td>{account.username ?? "—"}</td>
                        <td>{roleLabels[account.role]}</td>
                        <td>{region(account)}</td>
                        <td><span className={account.is_active ? styles.active : styles.inactive}>{account.is_active ? "Aktif" : "Nonaktif"}</span></td>
                        <td>{formatDate(account.last_login_at)}</td>
                        <td>
                          <div className={styles.actions}>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditor({ mode: "edit", user: account })}>Ubah</button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={self}
                              title={self ? "Anda tidak dapat menonaktifkan akun sendiri." : undefined}
                              onClick={() => void toggle(account)}
                            >{account.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditor({ mode: "reset", user: account })}>
                              <RotateCcw size={20} aria-hidden="true" /> Reset kata sandi
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <Dialog open={editor !== null} onClose={() => setEditor(null)} title={editor?.mode === "edit" ? "Ubah akun" : editor?.mode === "reset" ? "Reset kata sandi" : "Tambah akun"}>
        {editor && (
          <AccountForm
            key={editor.mode === "create" ? "create" : `${editor.mode}-${editor.user.id}`}
            editor={editor}
            lockRole={editor.mode !== "create" && editor.user.id === currentUser?.id}
            onCreate={create}
            onUpdate={update}
            onReset={reset}
            onCancel={() => setEditor(null)}
          />
        )}
      </Dialog>

      <Dialog open={temporary !== null} onClose={() => setTemporary(null)} title="Kata sandi sementara">
        {temporary && <TemporaryPassword name={temporary.name} password={temporary.password} onClose={() => setTemporary(null)} />}
      </Dialog>
    </div>
  );
}

function AccountForm({ editor, lockRole, onCreate, onUpdate, onReset, onCancel }: {
  editor: Editor;
  lockRole: boolean;
  onCreate: (values: AccountValues) => Promise<void>;
  onUpdate: (target: StaffUser, values: AccountValues) => Promise<void>;
  onReset: (target: StaffUser, password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const target = editor.mode === "create" ? null : editor.user;
  const [name, setName] = useState(target?.name ?? "");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<StaffRole>(target?.role ?? "staff");
  const [rt, setRt] = useState(target?.rt ?? "");
  const [rw, setRw] = useState(target?.rw ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (editor.mode !== "reset" && password && password.length < 10) return setError("Kata sandi sementara minimal 10 karakter.");
    if (editor.mode === "create" && password.length < 10) return setError("Kata sandi sementara minimal 10 karakter.");
    if (editor.mode !== "reset" && role === "rt_head" && (!rt || !rw)) return setError("Ketua RT memerlukan RT dan RW.");
    if (editor.mode !== "reset" && role === "rw_head" && !rw) return setError("Ketua RW memerlukan RW.");
    setBusy(true);
    try {
      if (editor.mode === "reset") {
        await onReset(editor.user, password);
      } else {
        const values: AccountValues = {
          name,
          username,
          role,
          password,
          rt: role === "rt_head" ? rt : null,
          rw: role === "rt_head" || role === "rw_head" ? rw : null,
        };
        if (editor.mode === "create") await onCreate(values);
        else await onUpdate(editor.user, values);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Akun belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  if (editor.mode === "reset") {
    return (
      <form className="fields" onSubmit={submit}>
        <p className="field wide">Buat kata sandi sementara untuk <strong>{editor.user.name}</strong>. Petugas wajib menggantinya saat masuk, dan semua sesinya yang lain akan berakhir.</p>
        <div className="field wide">
          <label htmlFor={`${id}-password`}>Kata sandi sementara (minimal 10 karakter)</label>
          <input id={`${id}-password`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} required />
        </div>
        {error && <div className="field wide"><p className="error-box" role="alert">{error}</p></div>}
        <div className="field wide">
          <div className={styles.formActions}>
            <button className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Reset kata sandi"}</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form className="fields" onSubmit={submit}>
      <div className="field wide">
        <label htmlFor={`${id}-name`}>Nama lengkap</label>
        <input id={`${id}-name`} type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required />
      </div>
      {editor.mode === "create" && (
        <div className="field wide">
          <label htmlFor={`${id}-username`}>Username</label>
          <input id={`${id}-username`} type="text" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={64} pattern="[a-z0-9][a-z0-9_-]*" autoCapitalize="none" spellCheck={false} required />
          <p className={styles.help}>Huruf kecil, angka, tanda hubung, atau garis bawah. Tidak bisa diubah setelah akun dibuat.</p>
        </div>
      )}
      <div className="field wide">
        <label htmlFor={`${id}-role`}>Peran</label>
        <select id={`${id}-role`} value={role} onChange={(event) => setRole(event.target.value as StaffRole)} disabled={lockRole}>
          {roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
        </select>
        {lockRole && <p className={styles.help}>Anda tidak dapat menurunkan peran akun sendiri.</p>}
      </div>
      {role === "rt_head" && (
        <>
          <div className="field">
            <label htmlFor={`${id}-rt`}>RT</label>
            <input id={`${id}-rt`} type="text" inputMode="numeric" value={rt ?? ""} onChange={(event) => setRt(event.target.value)} maxLength={3} pattern="[0-9]{1,3}" required />
          </div>
          <div className="field">
            <label htmlFor={`${id}-rw`}>RW</label>
            <input id={`${id}-rw`} type="text" inputMode="numeric" value={rw ?? ""} onChange={(event) => setRw(event.target.value)} maxLength={3} pattern="[0-9]{1,3}" required />
          </div>
        </>
      )}
      {role === "rw_head" && (
        <div className="field">
          <label htmlFor={`${id}-rw`}>RW</label>
          <input id={`${id}-rw`} type="text" inputMode="numeric" value={rw ?? ""} onChange={(event) => setRw(event.target.value)} maxLength={3} pattern="[0-9]{1,3}" required />
        </div>
      )}
      {editor.mode === "create" && (
        <div className="field wide">
          <label htmlFor={`${id}-password`}>Kata sandi sementara (minimal 10 karakter)</label>
          <input id={`${id}-password`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} required />
          <p className={styles.help}>Petugas wajib menggantinya saat pertama kali masuk.</p>
        </div>
      )}
      {error && <div className="field wide"><p className="error-box" role="alert">{error}</p></div>}
      <div className="field wide">
        <div className={styles.formActions}>
          <button className="btn" disabled={busy}>{busy ? "Menyimpan..." : editor.mode === "create" ? "Buat akun" : "Simpan perubahan"}</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
        </div>
      </div>
    </form>
  );
}

function TemporaryPassword({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  async function copy() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError("Tidak dapat menyalin otomatis. Pilih dan salin teks kata sandi secara manual.");
    }
  }

  return (
    <div>
      <p>Berikan kata sandi ini kepada <strong>{name}</strong>. Kata sandi hanya ditampilkan sekali dan tidak dapat dilihat lagi.</p>
      <div className={styles.secret}>
        <code>{password}</code>
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}><Copy size={20} aria-hidden="true" /> Salin</button>
      </div>
      {copied && <p className={styles.success} role="status">Kata sandi tersalin.</p>}
      {copyError && <p className="error-box" role="alert">{copyError}</p>}
      <button type="button" className="btn mt-4" onClick={onClose}>Selesai</button>
    </div>
  );
}

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="admin-dialog" aria-labelledby={id} onClose={onClose}>
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}

function region(account: StaffUser) {
  if (account.role === "rt_head") return `RT ${account.rt ?? "—"} / RW ${account.rw ?? "—"}`;
  if (account.role === "rw_head") return `RW ${account.rw ?? "—"}`;
  return "—";
}

function formatDate(value: string | null) {
  if (!value) return "Belum pernah";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

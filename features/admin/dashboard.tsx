"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { apiBase, apiRequest } from "@/services/pelayanan";
import { StatusBadge } from "@/components/site";
import { DataTable } from "@/components/data-table";
import type { ServiceCode, Status } from "@/types/pelayanan";

type RecordItem = { request_id: string; nama: string; jenis_surat: ServiceCode; status: Status; catatan: string | null; created_at: string };
type Page = { data: RecordItem[]; current_page: number; last_page: number; total: number };
const transitions: Partial<Record<Status, Status[]>> = {
  SUBMITTED: ["VERIFIED", "NEED_REVISION", "REJECTED"],
  VERIFIED: ["PROCESSING", "NEED_REVISION", "REJECTED"],
  PROCESSING: ["WAITING_APPROVAL", "NEED_REVISION", "REJECTED"],
  WAITING_APPROVAL: ["APPROVED", "NEED_REVISION", "REJECTED"],
  NEED_REVISION: ["VERIFIED", "REJECTED"],
};
export function AdminDashboard({ section = "" }: { section?: string }) {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [records, setRecords] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = records?.data.find((item) => item.request_id === selected);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (section === "surat") query.set("status", "APPROVED");
      else if (filter) query.set("status", filter);
      const result = await apiRequest<Page>(`/staff/applications?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      setRecords(result);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengambil data.");
      setRecords(null);
    }
  }, [token, page, filter, section]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await apiRequest<{ token: string }>("/staff/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setPassword(""); setToken(result.token);
    } catch (e) { setError(e instanceof Error ? e.message : "Login gagal."); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await apiRequest('/staff/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); }
    finally { setToken(""); setRecords(null); setSelected(null); }
  }
  async function change(status: Status) {
    if (!current) return;
    if (["NEED_REVISION", "REJECTED"].includes(status) && note.trim().length < 2) { setError("Masukkan alasan penolakan atau perbaikan."); return; }
    setBusy(true); setError("");
    try {
      await apiRequest(`/staff/applications/${encodeURIComponent(current.request_id)}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status, catatan: note.trim() || null }) });
      setSelected(null); setNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memperbarui status."); }
    finally { setBusy(false); }
  }
  if (!apiBase) return <div className="center-card"><h1>Panel petugas belum terhubung</h1><p className="mt-3">Atur NEXT_PUBLIC_API_URL ke alamat API Laravel sebelum mengakses panel petugas.</p></div>;
  if (!token) return <div className="center-card"><h1>Masuk sebagai petugas</h1><p className="mt-3 mb-5">Gunakan akun yang dibuat oleh administrator desa.</p><form onSubmit={login} className="fields"><label htmlFor="staff-email">Email petugas</label><input id="staff-email" className="search-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /><label htmlFor="staff-password">Kata sandi</label><input id="staff-password" className="search-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /><button id="staff-login" className="btn" disabled={busy}>Masuk</button></form>{error && <p className="error-box" role="alert">{error}</p>}</div>;
  return <>
    <header className="admin-header"><div><div className="eyebrow">RUANG KERJA PEMERINTAH DESA</div><h1>{section === "surat" ? "Permohonan disetujui" : "Permohonan warga"}</h1><p>Daftar pengajuan dari API Laravel; data pribadi sensitif tidak ditampilkan.</p></div><div className="button-row"><button id="refresh-applications" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={16} /> Muat ulang</button><button id="staff-logout" className="btn btn-secondary" onClick={() => void logout()}>Keluar</button><Link href="/" className="btn btn-secondary">Website <ArrowUpRight size={16} /></Link></div></header>
    {!['', 'permohonan', 'surat'].includes(section) && <p className="notice">Penyuntingan konten {section} belum tersedia. Gunakan panel ini untuk pelayanan terlebih dahulu.</p>}
    <div className="table-card"><div className="table-toolbar"><h2>Daftar permohonan ({records?.total ?? 0})</h2><label htmlFor="admin-status-filter">Filter status</label><select id="admin-status-filter" className="search-input" value={section === 'surat' ? 'APPROVED' : filter} disabled={section === 'surat'} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">Semua</option>{Object.keys(transitions).concat('APPROVED','REJECTED').map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
    <DataTable rows={(records?.data ?? []).filter((r) => section !== 'surat' || r.status === 'APPROVED')} rowKey={(r) => r.request_id} empty="Tidak ada permohonan pada halaman ini." columns={[{ label: "ID", render: (r) => r.request_id },{ label: "Pemohon", render: (r) => r.nama },{ label: "Layanan", render: (r) => r.jenis_surat },{ label: "Tanggal", render: (r) => new Date(r.created_at).toLocaleDateString('id-ID') },{ label: "Status", render: (r) => <StatusBadge status={r.status} /> },{ label: "Aksi", render: (r) => <button id={`open-${r.request_id}`} className="table-action" onClick={() => { setSelected(r.request_id); setNote(r.catatan || ''); }}>Detail</button> }]} />
    <div className="button-row mt-5"><button id="prev-applications" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page-1)}>Sebelumnya</button><span>Halaman {records?.current_page ?? page} / {records?.last_page ?? 1}</span><button id="next-applications" className="btn btn-secondary" disabled={!records || page >= records.last_page} onClick={() => setPage(page+1)}>Berikutnya</button></div></div>
    {current && <section className="detail-panel" aria-label="Detail permohonan"><h2>{current.request_id}</h2><p>{current.nama} · {current.jenis_surat}</p><StatusBadge status={current.status} /><p className="mt-3">{current.catatan}</p><label htmlFor="staff-note">Catatan status</label><textarea id="staff-note" className="search-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /><div className="button-row mt-5">{(transitions[current.status] || []).map((status) => <button id={`status-${status}`} key={status} className="btn btn-secondary" disabled={busy} onClick={() => void change(status)}>{status}</button>)}</div><button id="close-detail" className="table-action mt-5" onClick={() => setSelected(null)}>Tutup</button></section>}
    {error && <p className="error-box" role="alert">{error}</p>}
  </>;
}

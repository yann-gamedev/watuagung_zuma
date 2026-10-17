"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/site";
import { DataTable } from "@/components/data-table";
import type { ServiceCode, Status } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";

type RecordItem = { request_id: string; nama: string; jenis_surat: ServiceCode; status: Status; catatan: string | null; created_at: string };
type Page = { data: RecordItem[]; current_page: number; last_page: number; total: number };
// Salinan aturan backend untuk tombol; server tetap memvalidasi setiap transisi.
const transitions: Partial<Record<Status, Status[]>> = {
  SUBMITTED: ["VERIFIED", "NEED_REVISION", "REJECTED"],
  VERIFIED: ["PROCESSING", "NEED_REVISION", "REJECTED"],
  PROCESSING: ["WAITING_APPROVAL", "NEED_REVISION", "REJECTED"],
  WAITING_APPROVAL: ["APPROVED", "NEED_REVISION", "REJECTED"],
  NEED_REVISION: ["VERIFIED", "REJECTED"],
};

/** Tabel permohonan; dipindahkan dari dashboard.tsx tanpa perubahan fungsi. */
export function ApplicationsTable({ section }: { section: "permohonan" | "surat" }) {
  const { request } = useAdminSession();
  const [records, setRecords] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = records?.data.find((item) => item.request_id === selected);
  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (section === "surat") query.set("status", "APPROVED");
      else if (filter) query.set("status", filter);
      const result = await request<Page>(`/staff/applications?${query}`);
      setRecords(result);
      setError("");
    } catch (e) {
      // 401 sudah ditangani sesi: komponen ini akan dilepas dan login tampil.
      if (e instanceof AdminUnauthorizedError) return;
      setError(e instanceof Error ? e.message : "Gagal mengambil data.");
      setRecords(null);
    }
  }, [request, page, filter, section]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function change(status: Status) {
    if (!current) return;
    if (["NEED_REVISION", "REJECTED"].includes(status) && note.trim().length < 2) { setError("Masukkan alasan penolakan atau perbaikan."); return; }
    setBusy(true); setError("");
    try {
      await request(`/staff/applications/${encodeURIComponent(current.request_id)}/status`, { method: "PATCH", body: JSON.stringify({ status, catatan: note.trim() || null }) });
      setSelected(null); setNote(""); await load();
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) return;
      setError(e instanceof Error ? e.message : "Gagal memperbarui status.");
    } finally { setBusy(false); }
  }
  return <>
    <div className="admin-page-intro">
      <p>Daftar pengajuan dari API Laravel; data pribadi sensitif tidak ditampilkan.</p>
      <button id="refresh-applications" className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={22} aria-hidden="true" /> Muat ulang</button>
    </div>
    <div className="table-card"><div className="table-toolbar"><h2>Daftar permohonan ({records?.total ?? 0})</h2><div className="table-filter"><label htmlFor="admin-status-filter">Filter status</label><select id="admin-status-filter" className="search-input" value={section === "surat" ? "APPROVED" : filter} disabled={section === "surat"} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">Semua</option>{Object.keys(transitions).concat("APPROVED", "REJECTED").map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div>
    <DataTable rows={(records?.data ?? []).filter((r) => section !== "surat" || r.status === "APPROVED")} rowKey={(r) => r.request_id} empty="Tidak ada permohonan pada halaman ini." columns={[{ label: "ID", render: (r) => r.request_id },{ label: "Pemohon", render: (r) => r.nama },{ label: "Layanan", render: (r) => r.jenis_surat },{ label: "Tanggal", render: (r) => new Date(r.created_at).toLocaleDateString("id-ID") },{ label: "Status", render: (r) => <StatusBadge status={r.status} /> },{ label: "Aksi", render: (r) => <button id={`open-${r.request_id}`} className="table-action" onClick={() => { setSelected(r.request_id); setNote(r.catatan || ""); }}>Detail</button> }]} />
    <div className="table-pager"><button id="prev-applications" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button><span>Halaman {records?.current_page ?? page} / {records?.last_page ?? 1}</span><button id="next-applications" className="btn btn-secondary" disabled={!records || page >= records.last_page} onClick={() => setPage(page + 1)}>Berikutnya</button></div></div>
    {current && <section className="detail-panel" aria-label="Detail permohonan"><h2>{current.request_id}</h2><p>{current.nama} · {current.jenis_surat}</p><StatusBadge status={current.status} /><p className="mt-3">{current.catatan}</p><label htmlFor="staff-note">Catatan status</label><textarea id="staff-note" className="search-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /><div className="button-row mt-5">{(transitions[current.status] || []).map((status) => <button id={`status-${status}`} key={status} className="btn btn-secondary" disabled={busy} onClick={() => void change(status)}>{status}</button>)}</div><button id="close-detail" className="table-action mt-5" onClick={() => setSelected(null)}>Tutup</button></section>}
    {error && <p className="error-box" role="alert">{error}</p>}
  </>;
}

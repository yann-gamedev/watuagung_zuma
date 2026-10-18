"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatusBadge, statusLabels } from "@/components/site";
import { DataTable } from "@/components/data-table";
import { statuses, type Status, type StaffApplicationsPage, type StaffStatusResponse } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";

// Hanya label presentasi; izin dan urutan transisi berasal dari server.
const actionLabels: Record<Status, string> = {
  SUBMITTED: "Terima", VERIFIED: "Verifikasi", PROCESSING: "Proses",
  WAITING_APPROVAL: "Ajukan ke Kepala Desa", APPROVED: "Setujui",
  READY_FOR_PICKUP: "Tandai siap diambil", COMPLETED: "Tandai sudah diambil",
  NEED_REVISION: "Minta perbaikan", REJECTED: "Tolak",
};

export function ApplicationsTable({ section }: { section: "permohonan" | "surat" | "persetujuan" }) {
  const { request, user } = useAdminSession();
  const [records, setRecords] = useState<StaffApplicationsPage | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const restricted = section === "persetujuan" && user?.role !== "village_head";
  const current = records?.data.find((item) => item.request_id === selected);
  const filterStatuses = section === "surat" ? statuses.filter((s) => s === "APPROVED" || s === "READY_FOR_PICKUP") : statuses;
  const load = useCallback(async () => {
    if (restricted) return;
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (section === "persetujuan") query.set("status", "WAITING_APPROVAL");
      else if (filter) query.set("status", filter);
      else if (section === "surat") {
        query.append("statuses[]", "APPROVED");
        query.append("statuses[]", "READY_FOR_PICKUP");
      }
      const result = await request<StaffApplicationsPage>(`/staff/applications?${query}`);
      setRecords(result);
      setError("");
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) return;
      setError(e instanceof Error ? e.message : "Gagal mengambil data.");
      setRecords(null);
    }
  }, [request, page, filter, section, restricted]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function change(status: Status) {
    if (!current || !current.allowed_transitions.includes(status)) return;
    if (["NEED_REVISION", "REJECTED"].includes(status) && !note.trim()) { setError("Masukkan alasan penolakan atau perbaikan."); return; }
    setBusy(true); setError("");
    try {
      await request<StaffStatusResponse>(`/staff/applications/${encodeURIComponent(current.request_id)}/status`, { method: "PATCH", body: JSON.stringify({ status, catatan: note.trim() || null }) });
      setSelected(null); setNote(""); await load();
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) return;
      setError(e instanceof Error ? e.message : "Gagal memperbarui status.");
    } finally { setBusy(false); }
  }
  if (restricted) return <p className="error-box" role="alert">Halaman Persetujuan hanya tersedia untuk Kepala Desa.</p>;
  return <>
    <div className="admin-page-intro">
      <p>{section === "surat" ? "Surat yang sudah disetujui dan yang siap diambil. Tandai selesai setelah warga mengambil surat." : section === "persetujuan" ? "Pengajuan yang menunggu keputusan Kepala Desa." : "Daftar pengajuan dari API Laravel; data pribadi sensitif tidak ditampilkan."}</p>
      <button id="refresh-applications" className="btn btn-secondary" disabled={busy} onClick={() => void load()}><RefreshCw size={22} aria-hidden="true" /> Muat ulang</button>
    </div>
    <div className="table-card"><div className="table-toolbar"><h2>Daftar permohonan ({records?.total ?? 0})</h2><div className="table-filter"><label htmlFor="admin-status-filter">Filter status</label><select id="admin-status-filter" className="search-input" value={section === "persetujuan" ? "WAITING_APPROVAL" : filter} disabled={busy || section === "persetujuan"} onChange={(e) => { setFilter(e.target.value); setPage(1); setSelected(null); }}><option value="">{section === "surat" ? "Disetujui dan siap diambil" : "Semua"}</option>{filterStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div></div>
    <DataTable rows={records?.data ?? []} rowKey={(r) => r.request_id} empty="Tidak ada permohonan pada halaman ini." columns={[{ label: "ID", render: (r) => r.request_id },{ label: "Pemohon", render: (r) => r.nama },{ label: "Layanan", render: (r) => r.jenis_surat },{ label: "Tanggal", render: (r) => new Date(r.created_at).toLocaleDateString("id-ID") },{ label: "Status", render: (r) => <StatusBadge status={r.status} /> },{ label: "Aksi", render: (r) => <button id={`open-${r.request_id}`} className="table-action" disabled={busy} onClick={() => { setSelected(r.request_id); setNote(""); }}>Detail</button> }]} />
    <div className="table-pager"><button id="prev-applications" className="btn btn-secondary" disabled={busy || page <= 1} onClick={() => { setPage(page - 1); setSelected(null); }}>Sebelumnya</button><span>Halaman {records?.current_page ?? page} / {records?.last_page ?? 1}</span><button id="next-applications" className="btn btn-secondary" disabled={busy || !records || page >= records.last_page} onClick={() => { setPage(page + 1); setSelected(null); }}>Berikutnya</button></div></div>
    {current && <section className="detail-panel" aria-label="Detail permohonan"><h2>{current.request_id}</h2><p>{current.nama} · {current.jenis_surat}</p><StatusBadge status={current.status} /><p className="mt-3">{current.catatan}</p>{current.allowed_transitions.length > 0 ? <><label htmlFor="staff-note">Catatan status</label><textarea id="staff-note" className="search-input" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} maxLength={1000} /><div className="button-row mt-5">{current.allowed_transitions.map((status) => <button id={`status-${status}`} key={status} className="btn btn-secondary" disabled={busy} onClick={() => void change(status)}>{actionLabels[status]}</button>)}</div></> : <p className="mt-3">Tidak ada tindakan yang tersedia untuk peran Anda pada status ini.</p>}<button id="close-detail" className="table-action mt-5" disabled={busy} onClick={() => setSelected(null)}>Tutup</button></section>}
    {error && <p className="error-box" role="alert">{error}</p>}
  </>;
}

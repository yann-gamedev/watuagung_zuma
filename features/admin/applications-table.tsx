"use client";

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { StatusBadge, statusLabels } from "@/components/site";
import { statuses, type StaffApplicationsPage } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import {
  APPLICATION_SEARCH_MAX_LENGTH,
  applicationServiceLabels,
  buildApplicationDetailHref,
  buildApplicationQuery,
  buildApplicationsApiPath,
  buildApplicationsHref,
  parseApplicationFilters,
  type ApplicationFilters,
  type ApplicationSection,
} from "./application-filters";
import styles from "./applications.module.css";

export function ApplicationsTable({ section }: { section: ApplicationSection }) {
  const { user } = useAdminSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseApplicationFilters(searchParams, section);
  const query = buildApplicationQuery(filters, section).toString();
  const apiPath = buildApplicationsApiPath(section, filters);
  const [attempt, setAttempt] = useState(0);
  const restricted = section === "persetujuan" && user?.role !== "village_head";
  const filterStatuses = section === "surat"
    ? statuses.filter((status) => status === "APPROVED" || status === "READY_FOR_PICKUP")
    : section === "persetujuan" ? ["WAITING_APPROVAL"] as const : statuses;

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const name of ["q", "status", "jenis_surat", "sort"]) {
      params.set(name, String(form.get(name) ?? ""));
    }
    const next = parseApplicationFilters(params, section);
    router.push(buildApplicationsHref(section, next), { scroll: false });
  }

  if (restricted) return <p className="error-box" role="alert">Halaman Persetujuan hanya tersedia untuk Kepala Desa.</p>;

  return <div className={styles.list}>
    <div className={styles.intro}>
      <p>{section === "surat"
        ? "Surat yang sudah disetujui dan yang siap diambil. Buka detail untuk menandai surat yang sudah diambil."
        : section === "persetujuan"
          ? "Pengajuan yang menunggu keputusan Kepala Desa. Buka detail untuk memeriksa pengajuan."
          : "Cari dan periksa pengajuan surat. Buka nomor permohonan untuk melihat detail dan tindakan yang tersedia."}</p>
      <button id="refresh-applications" type="button" className="btn btn-secondary" onClick={() => setAttempt((value) => value + 1)}>
        <RefreshCw size={22} aria-hidden="true" /> Muat ulang
      </button>
    </div>
    <section className={styles.panel} aria-labelledby="applications-title">
      <h2 id="applications-title">Daftar permohonan</h2>
      <form key={query} className={styles.filters} onSubmit={submitFilters} aria-label="Cari dan filter permohonan">
        <div className={styles.searchField}>
          <label htmlFor="admin-application-search">Nomor pengajuan atau nama pemohon</label>
          <input id="admin-application-search" name="q" type="search" defaultValue={filters.q} maxLength={APPLICATION_SEARCH_MAX_LENGTH} autoComplete="off" />
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-status-filter">Status</label>
          <select id="admin-status-filter" name="status" defaultValue={filters.status} disabled={section === "persetujuan"}>
            {section !== "persetujuan" && <option value="">{section === "surat" ? "Disetujui dan siap diambil" : "Semua status"}</option>}
            {filterStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-service-filter">Jenis surat</label>
          <select id="admin-service-filter" name="jenis_surat" defaultValue={filters.jenis_surat}>
            <option value="">Semua jenis surat</option>
            {Object.entries(applicationServiceLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-sort-filter">Urutan</label>
          <select id="admin-sort-filter" name="sort" defaultValue={filters.sort}>
            <option value="terbaru">Terbaru</option>
            <option value="terlama">Terlama</option>
          </select>
        </div>
        <div className={styles.filterActions}>
          <button type="submit" className="btn btn-primary"><Search size={22} aria-hidden="true" /> Terapkan filter</button>
          <Link className="btn btn-secondary" href={buildApplicationsHref(section, parseApplicationFilters(new URLSearchParams(), section))} scroll={false}>Hapus filter</Link>
        </div>
      </form>
      {/* Remount per query/retry: results from a previous request are never shown. */}
      <ApplicationResults key={`${apiPath}:${attempt}`} apiPath={apiPath} section={section} filters={filters} />
    </section>
  </div>;
}

function ApplicationResults({ apiPath, section, filters }: { apiPath: string; section: ApplicationSection; filters: ApplicationFilters }) {
  const { request } = useAdminSession();
  const router = useRouter();
  const [records, setRecords] = useState<StaffApplicationsPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void request<StaffApplicationsPage>(apiPath).then((result) => {
      if (!cancelled) setRecords(result);
    }).catch((cause: unknown) => {
      if (cancelled || cause instanceof AdminUnauthorizedError) return;
      setError(cause instanceof Error ? cause.message : "Gagal mengambil daftar permohonan. Silakan coba lagi.");
    });
    return () => { cancelled = true; };
  }, [apiPath, request]);

  function openRow(event: MouseEvent<HTMLTableRowElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((event.target as HTMLElement).closest("a") || window.getSelection()?.toString()) return;
    router.push(href);
  }

  if (error) return <p className={styles.error} role="alert">{error} Gunakan tombol Muat ulang untuk mencoba lagi.</p>;
  if (!records) return <p className={styles.message} role="status">Memuat daftar permohonan…</p>;

  return <>
    <p className={styles.summary} role="status">{records.total} permohonan ditemukan.</p>
    {records.data.length === 0 ? <p className={styles.message}>Tidak ada permohonan pada halaman ini. Ubah filter atau kembali ke halaman sebelumnya.</p> : <>
      <div className={styles.tableScroll}>
        <table className={styles.table} aria-label="Daftar permohonan surat">
          <thead><tr>{["Nomor", "Pemohon", "Layanan", "Tanggal", "Status"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{records.data.map((record) => {
            const href = buildApplicationDetailHref(record.request_id, section, filters);
            return <tr key={record.request_id} onClick={(event) => openRow(event, href)}>
              <td><Link className={styles.numberLink} href={href} prefetch={false} aria-label={`Buka detail permohonan ${record.request_id}`}>{record.request_id}</Link></td>
              <td>{record.nama}</td>
              <td>{applicationServiceLabels[record.jenis_surat]}</td>
              <td><time dateTime={record.created_at}>{formatDate(record.created_at)}</time></td>
              <td><StatusBadge status={record.status} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <ul className={styles.cards} aria-label="Daftar permohonan surat">{records.data.map((record) => <li key={record.request_id}>
        <Link className={styles.card} href={buildApplicationDetailHref(record.request_id, section, filters)} prefetch={false}>
          <span className={styles.cardNumber}>{record.request_id}</span>
          <dl>
            <div><dt>Pemohon</dt><dd>{record.nama}</dd></div>
            <div><dt>Layanan</dt><dd>{applicationServiceLabels[record.jenis_surat]}</dd></div>
            <div><dt>Tanggal</dt><dd><time dateTime={record.created_at}>{formatDate(record.created_at)}</time></dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={record.status} /></dd></div>
          </dl>
          <span className={styles.cardAction}>Buka detail permohonan</span>
        </Link>
      </li>)}</ul>
    </>}
    <nav className={styles.pager} aria-label="Halaman daftar permohonan">
      {filters.page > 1
        ? <Link id="prev-applications" className="btn btn-secondary" href={buildApplicationsHref(section, { ...filters, page: filters.page - 1 })} scroll={false}>Sebelumnya</Link>
        : <span className={`btn btn-secondary ${styles.disabled}`} aria-disabled="true">Sebelumnya</span>}
      <span>Halaman {records.current_page} / {records.last_page}</span>
      {filters.page < records.last_page
        ? <Link id="next-applications" className="btn btn-secondary" href={buildApplicationsHref(section, { ...filters, page: filters.page + 1 })} scroll={false}>Berikutnya</Link>
        : <span className={`btn btn-secondary ${styles.disabled}`} aria-disabled="true">Berikutnya</span>}
    </nav>
  </>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type RefObject } from "react";
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
  // Form and results remount per query; after a user-triggered change, focus the new result summary.
  const focusResultsRef = useRef(false);
  const neighborhood = section === "antrean-rt" || section === "antrean-rw";
  const userQueue = user?.role === "rt_head" ? "antrean-rt" : user?.role === "rw_head" ? "antrean-rw" : null;
  const restricted = userQueue ? section !== userQueue : neighborhood || (section === "persetujuan" && user?.role !== "village_head");
  const filterStatuses = section === "surat"
    ? statuses.filter((status) => status === "APPROVED" || status === "READY_FOR_PICKUP")
    : section === "persetujuan" ? ["WAITING_APPROVAL"] as const : statuses;

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const name of ["q", "status", "jenis_surat", "sort", "view", "my_queue", "today"]) {
      params.set(name, String(form.get(name) ?? ""));
    }
    const next = parseApplicationFilters(params, section);
    focusResultsRef.current = true;
    router.push(buildApplicationsHref(section, next), { scroll: false });
  }

  if (restricted) return <div className={styles.list}>
    <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>
    <Link className="btn btn-secondary" href={userQueue ? `/admin/${userQueue}/` : "/admin/"}>{userQueue ? "Buka antrean wilayah Anda" : "Kembali ke Dashboard"}</Link>
  </div>;

  return <div className={styles.list} data-neighborhood={neighborhood}>
    <div className={styles.intro}>
      <p>{neighborhood
        ? "Periksa pengajuan di wilayah Anda. Pilih Menunggu keputusan untuk memberi persetujuan, atau Semua pengajuan wilayah untuk membaca pengajuan yang sudah diputuskan."
        : section === "surat"
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
        {filters.my_queue && <input type="hidden" name="my_queue" value="1" />}
        {filters.today && <input type="hidden" name="today" value="1" />}
        {(filters.my_queue || filters.today) && <p className={styles.searchField}>Filter aktif: {[filters.my_queue && "Perlu tindakan Anda", filters.today && "Masuk hari ini"].filter(Boolean).join(" · ")}. Gunakan Hapus filter untuk melihat semua permohonan.</p>}
        <div className={styles.searchField}>
          <label htmlFor="admin-application-search">Nomor pengajuan atau nama pemohon</label>
          <input id="admin-application-search" name="q" type="search" defaultValue={filters.q} maxLength={APPLICATION_SEARCH_MAX_LENGTH} autoComplete="off" />
        </div>
        {neighborhood ? <div className={styles.field}>
          <label htmlFor="admin-queue-view">Tampilkan pengajuan</label>
          <select id="admin-queue-view" name="view" defaultValue={filters.view}>
            <option value="pending">Menunggu keputusan {section === "antrean-rt" ? "RT" : "RW"}</option>
            <option value="all">Semua pengajuan wilayah</option>
          </select>
        </div> : null}
        {(!neighborhood || filters.view === "all") && <div className={styles.field}>
          <label htmlFor="admin-status-filter">Status</label>
          <select id="admin-status-filter" name="status" defaultValue={filters.status} disabled={section === "persetujuan"}>
            {section !== "persetujuan" && <option value="">{section === "surat" ? "Disetujui dan siap diambil" : "Semua status"}</option>}
            {filterStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </div>}
        <div className={styles.field}>
          <label htmlFor="admin-service-filter">Jenis surat</label>
          <select id="admin-service-filter" name="jenis_surat" defaultValue={filters.jenis_surat}>
            <option value="">Semua jenis surat</option>
            {Object.entries(applicationServiceLabels).filter(([code]) => !neighborhood || code !== "SKU").map(([code, label]) => <option key={code} value={code}>{label}</option>)}
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
          <Link className="btn btn-secondary" href={buildApplicationsHref(section, parseApplicationFilters(new URLSearchParams(), section))} scroll={false} onClick={() => { focusResultsRef.current = true; }}>Hapus filter</Link>
        </div>
      </form>
      {/* Remount per query/retry: results from a previous request are never shown. */}
      <ApplicationResults key={`${apiPath}:${attempt}`} apiPath={apiPath} section={section} filters={filters} focusResultsRef={focusResultsRef} />
    </section>
  </div>;
}

function ApplicationResults({ apiPath, section, filters, focusResultsRef }: {
  apiPath: string; section: ApplicationSection; filters: ApplicationFilters; focusResultsRef: RefObject<boolean>;
}) {
  const { request } = useAdminSession();
  const router = useRouter();
  const [records, setRecords] = useState<StaffApplicationsPage | null>(null);
  const [error, setError] = useState("");
  const summaryRef = useRef<HTMLParagraphElement>(null);

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

  useEffect(() => {
    if ((records || error) && focusResultsRef.current) {
      focusResultsRef.current = false;
      summaryRef.current?.focus({ preventScroll: false });
    }
  }, [records, error, focusResultsRef]);

  function openRow(event: MouseEvent<HTMLTableRowElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((event.target as HTMLElement).closest("a") || window.getSelection()?.toString()) return;
    router.push(href);
  }

  if (error) return <p ref={summaryRef} tabIndex={-1} className={styles.error} role="alert">{error} Gunakan tombol Muat ulang untuk mencoba lagi.</p>;
  if (!records) return <p className={styles.message} role="status">Memuat daftar permohonan…</p>;
  const outOfRange = records.data.length === 0 && filters.page > 1 && filters.page > records.last_page;

  return <>
    <p ref={summaryRef} tabIndex={-1} className={styles.summary} role="status">{records.total} permohonan ditemukan.</p>
    {records.data.length === 0 ? <p className={styles.message}>
      {outOfRange
        ? <>Halaman ini tidak tersedia. <Link href={buildApplicationsHref(section, { ...filters, page: 1 })} scroll={false} onClick={() => { focusResultsRef.current = true; }}>Kembali ke halaman 1</Link></>
        : "Tidak ada permohonan yang cocok. Ubah atau hapus filter."}
    </p> : <>
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
              <td><StatusBadge status={record.status} jenisSurat={record.jenis_surat} /></td>
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
            <div><dt>Status</dt><dd><StatusBadge status={record.status} jenisSurat={record.jenis_surat} /></dd></div>
          </dl>
          <span className={styles.cardAction}>Buka detail permohonan</span>
        </Link>
      </li>)}</ul>
    </>}
    <nav className={styles.pager} aria-label="Halaman daftar permohonan">
      {filters.page > 1
        ? <Link id="prev-applications" className="btn btn-secondary" href={buildApplicationsHref(section, { ...filters, page: Math.min(filters.page - 1, Math.max(1, records.last_page)) })} scroll={false} onClick={() => { focusResultsRef.current = true; }}>Sebelumnya</Link>
        : <span className={`btn btn-secondary ${styles.disabled}`} aria-disabled="true">Sebelumnya</span>}
      <span>Halaman {records.current_page} / {records.last_page}</span>
      {filters.page < records.last_page
        ? <Link id="next-applications" className="btn btn-secondary" href={buildApplicationsHref(section, { ...filters, page: filters.page + 1 })} scroll={false} onClick={() => { focusResultsRef.current = true; }}>Berikutnya</Link>
        : <span className={`btn btn-secondary ${styles.disabled}`} aria-disabled="true">Berikutnya</span>}
    </nav>
  </>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

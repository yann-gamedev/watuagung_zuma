"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { z } from "zod";
import type { LetterRegisterPage } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { applicationServiceLabels } from "./application-filters";
import { useAdminSession } from "./session";
import styles from "./applications.module.css";

const pageSchema = z.object({
  data: z.array(z.object({ number: z.string(), issued_at: z.string(), jenis_surat: z.enum(["SKU", "DOMISILI", "SKTM", "KTP_KK"]), nama: z.string(), status: z.enum(["issued", "void"]) })),
  current_page: z.number().int().positive(), last_page: z.number().int().positive(), total: z.number().int().nonnegative(),
});

export function LetterRegister() {
  const { user } = useAdminSession();
  const [filters, setFilters] = useState({ year: "", jenis_surat: "", page: 1 });
  const [attempt, setAttempt] = useState(0);
  const focusResultsRef = useRef(false);
  const query = new URLSearchParams({ page: String(filters.page) });
  if (filters.year) query.set("year", filters.year);
  if (filters.jenis_surat) query.set("jenis_surat", filters.jenis_surat);
  const apiPath = `/staff/letter-register?${query}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    focusResultsRef.current = true;
    setFilters({ year: String(form.get("year") ?? ""), jenis_surat: String(form.get("jenis_surat") ?? ""), page: 1 });
    setAttempt((value) => value + 1);
  }
  if (!user || !["staff", "admin", "village_head"].includes(user.role)) return <div className={styles.list}>
    <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>
    <Link className="btn btn-secondary" href={user?.role === "rt_head" ? "/admin/antrean-rt/" : user?.role === "rw_head" ? "/admin/antrean-rw/" : "/admin/"}>Kembali ke panel Anda</Link>
  </div>;

  return <div className={`${styles.list} ${styles.register}`}>
    <div className={styles.intro}>
      <p>Nomor surat diberikan saat permohonan diajukan ke Kepala Desa. Nomor yang dibatalkan tetap tercatat dan tidak dipakai ulang.</p>
      <button type="button" className="btn btn-secondary" onClick={() => { focusResultsRef.current = true; setAttempt((value) => value + 1); }}><RefreshCw size={22} aria-hidden="true" /> Muat ulang</button>
    </div>
    <section className={styles.panel} aria-labelledby="register-heading">
      <h2 id="register-heading">Buku registrasi surat</h2>
      <form className={styles.filters} onSubmit={submit} aria-label="Filter buku registrasi">
        <div className={styles.field}>
          <label htmlFor="register-year">Tahun</label>
          <input id="register-year" name="year" type="number" min="1000" max="9999" step="1" placeholder="Tahun berjalan" aria-describedby="register-year-help" />
          <span id="register-year-help">Kosongkan untuk tahun berjalan sesuai waktu server.</span>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-service">Jenis surat</label>
          <select id="register-service" name="jenis_surat" defaultValue="">
            <option value="">Semua jenis surat</option>
            {Object.entries(applicationServiceLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <div className={styles.filterActions}><button className="btn" type="submit">Terapkan filter</button></div>
      </form>
      <RegisterResults key={`${apiPath}:${attempt}`} apiPath={apiPath} focusResultsRef={focusResultsRef} onPage={(page) => { focusResultsRef.current = true; setFilters({ ...filters, page }); }} />
    </section>
  </div>;
}

function RegisterResults({ apiPath, focusResultsRef, onPage }: { apiPath: string; focusResultsRef: RefObject<boolean>; onPage: (page: number) => void }) {
  const { request } = useAdminSession();
  const [result, setResult] = useState<LetterRegisterPage | null>(null);
  const [error, setError] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let cancelled = false;
    void request<unknown>(apiPath).then((response) => {
      const parsed = pageSchema.safeParse(response);
      if (!parsed.success) throw new Error("Format buku registrasi tidak sesuai. Hubungi pengelola.");
      if (!cancelled) setResult(parsed.data);
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Gagal memuat buku registrasi.");
    });
    return () => { cancelled = true; };
  }, [apiPath, request]);
  useEffect(() => {
    if ((result || error) && focusResultsRef.current) {
      focusResultsRef.current = false;
      summary.current?.focus();
    }
  }, [result, error, focusResultsRef]);

  if (error) return <p ref={summary} tabIndex={-1} className={styles.error} role="alert">{error} Gunakan Muat ulang untuk mencoba lagi.</p>;
  if (!result) return <p className={styles.message} role="status">Memuat buku registrasi…</p>;
  return <>
    <p ref={summary} tabIndex={-1} className={styles.summary} role="status">{result.total} nomor surat ditemukan.</p>
    {result.data.some((letter) => letter.number.includes("[PLACEHOLDER]")) && <p className={styles.message}>Format nomor masih sementara, menunggu ketentuan resmi desa.</p>}
    {result.data.length === 0 ? <p className={styles.message}>Tidak ada nomor surat pada halaman ini. Ubah filter atau kembali ke halaman sebelumnya.</p> : <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tabel buku registrasi, dapat digulir horizontal">
      <table className={styles.table}>
        <caption className="sr-only">Nomor surat yang diberikan dan dibatalkan</caption>
        <thead><tr>{["Nomor surat", "Tanggal", "Jenis surat", "Pemohon", "Status nomor"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{result.data.map((letter) => <tr key={letter.number}>
          <td>{letter.number}</td>
          <td><time dateTime={letter.issued_at}>{new Date(letter.issued_at).toLocaleDateString("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" })}</time></td>
          <td>{applicationServiceLabels[letter.jenis_surat]}</td><td>{letter.nama}</td>
          <td><span className={`status-badge status-${letter.status === "void" ? "REJECTED" : "VERIFIED"}`}>
            {letter.status === "void" ? <CircleX size={22} aria-hidden="true" /> : <CircleCheck size={22} aria-hidden="true" />}
            {letter.status === "void" ? "Dibatalkan" : "Diberikan"}
          </span></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <nav className={styles.pager} aria-label="Halaman buku registrasi">
      <button type="button" className="btn btn-secondary" disabled={result.current_page <= 1} onClick={() => onPage(Math.min(result.current_page - 1, result.last_page))}>Sebelumnya</button>
      <span>Halaman {result.current_page} / {result.last_page}</span>
      <button type="button" className="btn btn-secondary" disabled={result.current_page >= result.last_page} onClick={() => onPage(result.current_page + 1)}>Berikutnya</button>
    </nav>
  </>;
}

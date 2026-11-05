"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { businessCategoryLabels } from "@/services/businesses";
import { businessCategories } from "@/types/business";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import { staffBusinessesPageSchema } from "./business-data";
import { postDate } from "./news-data";
import { NewsStatus } from "./news-list";
import styles from "./applications.module.css";
import type { z } from "zod";

type Page = z.infer<typeof staffBusinessesPageSchema>;
const contactLabel = (consent: boolean) => consent ? "Ditampilkan" : "Tidak ditampilkan";

/** Pola sama dengan news-list.tsx. Daftar tidak memuat nama pemilik/WhatsApp (server tidak mengirimnya). */
export function BusinessList() {
  const { user } = useAdminSession();
  const [filters, setFilters] = useState({ q: "", status: "", category: "", page: 1 });
  const [attempt, setAttempt] = useState(0);
  const search = new URLSearchParams({ page: String(filters.page) });
  if (filters.q) search.set("q", filters.q);
  if (filters.status) search.set("status", filters.status);
  if (filters.category) search.set("category", filters.category);
  const query = search.toString();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFilters({ q: String(data.get("q") ?? "").trim(), status: String(data.get("status") ?? ""), category: String(data.get("category") ?? ""), page: 1 });
    setAttempt((n) => n + 1);
  }
  if (!user || !["admin", "staff"].includes(user.role)) return <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>;
  return <div className={styles.list}>
    <div className={styles.intro}><p>Kelola daftar UMKM warga. Hanya usaha berstatus Terbit yang tampil di website.</p><Link className="btn" href="/admin/umkm/tambah/">Tambah UMKM</Link></div>
    <section className={styles.panel} aria-labelledby="umkm-heading">
      <h2 id="umkm-heading">Daftar UMKM</h2>
      <form className={styles.filters} onSubmit={submit} aria-label="Filter UMKM">
        <div className={styles.field}><label htmlFor="umkm-search">Cari nama usaha</label><input id="umkm-search" name="q" maxLength={100} type="search" /></div>
        <div className={styles.field}><label htmlFor="umkm-category">Kategori</label><select id="umkm-category" name="category"><option value="">Semua kategori</option>{businessCategories.map((value) => <option key={value} value={value}>{businessCategoryLabels[value]}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="umkm-status">Status</label><select id="umkm-status" name="status"><option value="">Semua status</option><option value="draft">Draf</option><option value="published">Terbit</option></select></div>
        <div className={styles.filterActions}><button type="submit" className="btn">Terapkan filter</button><button type="button" className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>Muat ulang</button></div>
      </form>
      <BusinessResults key={`${query}:${attempt}`} query={query} onPage={(page) => setFilters({ ...filters, page })} />
    </section>
  </div>;
}

function BusinessResults({ query, onPage }: { query: string; onPage: (page: number) => void }) {
  const { request } = useAdminSession();
  const [result, setResult] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let cancelled = false;
    void request<unknown>(`/staff/businesses?${query}`).then((value) => {
      const parsed = staffBusinessesPageSchema.safeParse(value);
      if (!parsed.success) throw new Error("Format daftar UMKM tidak sesuai. Hubungi pengelola.");
      if (!cancelled) setResult(parsed.data);
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Gagal memuat UMKM.");
    });
    return () => { cancelled = true; };
  }, [query, request]);
  useEffect(() => { if (result || error) summary.current?.focus(); }, [result, error]);
  if (error) return <p ref={summary} tabIndex={-1} className={styles.error} role="alert">{error} Gunakan Muat ulang untuk mencoba lagi.</p>;
  if (!result) return <p role="status" className={styles.message}>Memuat UMKM…</p>;
  const href = (id: number) => `/admin/umkm/ubah/?id=${id}`;
  return <>
    <p ref={summary} tabIndex={-1} role="status" className={styles.summary}>{result.total} UMKM ditemukan.</p>
    {!result.data.length ? <p className={styles.message}>Tidak ada UMKM pada halaman ini. Ubah filter atau tambah UMKM baru.</p> : <>
      <div className={styles.tableScroll}><table className={styles.table}>
        <caption className="sr-only">Daftar UMKM, pilih nama usaha untuk menyunting atau menghapus</caption>
        <thead><tr>{["Nama usaha", "Kategori", "Dusun", "Status", "Kontak pemilik", "Diperbarui"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{result.data.map((item) => <tr key={item.id}>
          <td><Link className={styles.numberLink} href={href(item.id)}>{item.name}</Link></td><td>{item.category_label}</td><td>{item.hamlet ?? "—"}</td>
          <td><NewsStatus status={item.status} /></td><td>{contactLabel(item.consent_public_contact)}</td><td>{postDate(item.updated_at)}</td>
        </tr>)}</tbody>
      </table></div>
      <ul className={styles.cards}>{result.data.map((item) => <li key={item.id}><Link className={styles.card} href={href(item.id)}>
        <strong className={styles.cardNumber}>{item.name}</strong><dl>
          <div><dt>Kategori</dt><dd>{item.category_label}</dd></div><div><dt>Dusun</dt><dd>{item.hamlet ?? "—"}</dd></div>
          <div><dt>Status</dt><dd><NewsStatus status={item.status} /></dd></div><div><dt>Kontak pemilik</dt><dd>{contactLabel(item.consent_public_contact)}</dd></div>
          <div><dt>Diperbarui</dt><dd>{postDate(item.updated_at)}</dd></div>
        </dl><span className={styles.cardAction}>Sunting UMKM</span>
      </Link></li>)}</ul>
    </>}
    <nav className={styles.pager} aria-label="Halaman UMKM"><button className="btn btn-secondary" disabled={result.current_page <= 1} onClick={() => onPage(Math.min(result.current_page - 1, result.last_page))}>Sebelumnya</button><span>Halaman {result.current_page} / {result.last_page}</span><button className="btn btn-secondary" disabled={result.current_page >= result.last_page} onClick={() => onPage(result.current_page + 1)}>Berikutnya</button></nav>
  </>;
}

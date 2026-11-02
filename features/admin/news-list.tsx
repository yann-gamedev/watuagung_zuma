"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleCheck, FilePenLine } from "lucide-react";
import type { PostStatus, StaffPostsPage } from "@/types/posts";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import { postDate, postsPageSchema } from "./news-data";
import styles from "./applications.module.css";

export function NewsStatus({ status }: { status: PostStatus }) {
  return <span className={`status-badge status-${status === "published" ? "VERIFIED" : "WAITING_APPROVAL"}`}>
    {status === "published" ? <CircleCheck size={22} aria-hidden="true" /> : <FilePenLine size={22} aria-hidden="true" />}
    {status === "published" ? "Terbit" : "Draf"}
  </span>;
}

export function NewsList() {
  const { user } = useAdminSession();
  const [filters, setFilters] = useState({ q: "", status: "", page: 1 });
  const [attempt, setAttempt] = useState(0);
  const search = new URLSearchParams({ page: String(filters.page) });
  if (filters.q) search.set("q", filters.q);
  if (filters.status) search.set("status", filters.status);
  const query = search.toString();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFilters({ q: String(data.get("q") ?? "").trim(), status: String(data.get("status") ?? ""), page: 1 });
    setAttempt((n) => n + 1);
  }
  if (!user || !["admin", "staff"].includes(user.role)) return <NewsResults query={query} onPage={() => {}} />;
  return <div className={styles.list}>
    <div className={styles.intro}><p>Kelola draf dan berita terbit. Waktu ditampilkan dalam WIB.</p><Link className="btn" href="/admin/berita/tulis/">Tulis berita</Link></div>
    <section className={styles.panel} aria-labelledby="news-heading">
      <h2 id="news-heading">Daftar berita</h2>
      <form className={styles.filters} onSubmit={submit} aria-label="Filter berita">
        <div className={styles.field}><label htmlFor="news-search">Cari judul</label><input id="news-search" name="q" maxLength={100} type="search" /></div>
        <div className={styles.field}><label htmlFor="news-status">Status</label><select id="news-status" name="status"><option value="">Semua status</option><option value="draft">Draf</option><option value="published">Terbit</option></select></div>
        <div className={styles.filterActions}><button type="submit" className="btn">Terapkan filter</button><button type="button" className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>Muat ulang</button></div>
      </form>
      <NewsResults key={`${query}:${attempt}`} query={query} onPage={(page) => setFilters({ ...filters, page })} />
    </section>
  </div>;
}

function NewsResults({ query, onPage }: { query: string; onPage: (page: number) => void }) {
  const { request, user } = useAdminSession();
  const [result, setResult] = useState<StaffPostsPage | null>(null);
  const [error, setError] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let cancelled = false;
    void request<unknown>(`/staff/posts?${query}`).then((value) => {
      const parsed = postsPageSchema.safeParse(value);
      if (!parsed.success) throw new Error("Format daftar berita tidak sesuai. Hubungi pengelola.");
      if (!cancelled) setResult(parsed.data);
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Gagal memuat berita.");
    });
    return () => { cancelled = true; };
  }, [query, request]);
  useEffect(() => { if (result || error) summary.current?.focus(); }, [result, error]);
  if (error) return <p ref={summary} tabIndex={-1} className={styles.error} role="alert">{error} Gunakan Muat ulang untuk mencoba lagi.</p>;
  if (!result) return <p role="status" className={styles.message}>Memuat berita…</p>;
  if (!user || !["admin", "staff"].includes(user.role)) return <p role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>;
  return <>
    <p ref={summary} tabIndex={-1} role="status" className={styles.summary}>{result.total} berita ditemukan.</p>
    {!result.data.length ? <p className={styles.message}>Tidak ada berita pada halaman ini. Ubah filter atau kembali ke halaman sebelumnya.</p> : <>
      <div className={styles.tableScroll}><table className={styles.table}>
        <caption className="sr-only">Daftar berita, pilih judul untuk menyunting atau menghapus</caption>
        <thead><tr>{["Judul", "Kategori", "Status", "Tanggal terbit", "Diperbarui"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{result.data.map((post) => <tr key={post.id}>
          <td><Link className={styles.numberLink} href={`/admin/berita/ubah/?id=${post.id}`}>{post.title}</Link></td><td>{post.category_label}</td><td><NewsStatus status={post.status} /></td><td>{postDate(post.published_at)}</td><td>{postDate(post.updated_at)}</td>
        </tr>)}</tbody>
      </table></div>
      <ul className={styles.cards}>{result.data.map((post) => <li key={post.id}><Link className={styles.card} href={`/admin/berita/ubah/?id=${post.id}`}>
        <strong className={styles.cardNumber}>{post.title}</strong><dl><div><dt>Kategori</dt><dd>{post.category_label}</dd></div><div><dt>Status</dt><dd><NewsStatus status={post.status} /></dd></div><div><dt>Tanggal terbit</dt><dd>{postDate(post.published_at)}</dd></div><div><dt>Diperbarui</dt><dd>{postDate(post.updated_at)}</dd></div></dl><span className={styles.cardAction}>Sunting berita</span>
      </Link></li>)}</ul>
    </>}
    <nav className={styles.pager} aria-label="Halaman berita"><button className="btn btn-secondary" disabled={result.current_page <= 1} onClick={() => onPage(Math.min(result.current_page - 1, result.last_page))}>Sebelumnya</button><span>Halaman {result.current_page} / {result.last_page}</span><button className="btn btn-secondary" disabled={result.current_page >= result.last_page} onClick={() => onPage(result.current_page + 1)}>Berikutnya</button></nav>
  </>;
}

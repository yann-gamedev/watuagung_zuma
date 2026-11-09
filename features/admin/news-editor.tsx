"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { StaffPostDetail, StaffPostInput, PostStatus } from "@/types/posts";
import { NewsArticle } from "@/components/news-article";
import { can, useAdminSession } from "./session";
import { AdminUnauthorizedError } from "./api";
import { categoryLabels, parsePost, postDate, postInputSchema } from "./news-data";
import { NewsStatus } from "./news-list";
import styles from "./news.module.css";
import { useUnsavedChanges } from "./use-unsaved-changes";

const empty: StaffPostInput = { title: "", category: "kegiatan_desa", summary: "", body: "", status: "draft" };
// Penjagaan navigasi dipakai bersama editor bagian situs.
function fields(post: StaffPostInput): StaffPostInput {
  return { title: post.title, category: post.category, summary: post.summary, body: post.body, status: post.status };
}

export function NewsEditPage() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return <p className="error-box" role="alert">ID berita tidak valid. <Link href="/admin/berita/">Kembali ke daftar berita</Link></p>;
  return <NewsEditor key={id} id={Number(id)} />;
}

export function NewsEditor({ id }: { id?: number }) {
  const { request, user } = useAdminSession();
  const [post, setPost] = useState<StaffPostDetail | null>(null);
  const [value, setValue] = useState<StaffPostInput>(empty);
  const [saved, setSaved] = useState<StaffPostInput>(empty);
  const [loading, setLoading] = useState(!!id);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [localCover, setLocalCover] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const message = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved) || !!file || removeCover;
  useUnsavedChanges(dirty || busy);

  useEffect(() => {
    if (!id || !can(user, "media:manage")) return;
    let cancelled = false;
    void request<unknown>(id ? `/staff/posts/${id}` : "/staff/posts").then(parsePost).then((result) => {
      if (!cancelled) { setPost(result); setValue(fields(result)); setSaved(fields(result)); }
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Gagal memuat berita.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, request, attempt, user]);
  useEffect(() => {
    return () => { if (localCover) URL.revokeObjectURL(localCover); };
  }, [localCover]);
  useEffect(() => { if (error || notice) message.current?.focus(); }, [error, notice]);

  function adopt(result: StaffPostDetail) {
    setPost(result); setValue(fields(result)); setSaved(fields(result));
  }
  async function save(status: PostStatus) {
    if (inFlight.current) return;
    const parsed = postInputSchema.safeParse({ ...value, status });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); setNotice(""); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    let textSaved = false;
    try {
      // Always persist text first: upload needs an ID. Keep pending photo on failure for retry.
      let result = parsePost(await request<unknown>(post ? `/staff/posts/${post.id}` : "/staff/posts", { method: post ? "PATCH" : "POST", body: JSON.stringify(parsed.data) }));
      adopt(result); textSaved = true;
      if (file) {
        const data = new FormData(); data.append("file", file);
        result = parsePost(await request<unknown>(`/staff/posts/${result.id}/cover`, { method: "POST", body: data }));
        adopt(result); setFile(null); if (input.current) input.current.value = "";
      } else if (removeCover) {
        result = parsePost(await request<unknown>(`/staff/posts/${result.id}/cover`, { method: "DELETE" }));
        adopt(result);
      }
      setRemoveCover(false);
      setNotice(result.status === "published" ? "Berita terbit berhasil disimpan." : "Draf berhasil disimpan.");
    } catch (cause) {
      if (!(cause instanceof AdminUnauthorizedError)) {
        setError(cause instanceof Error ? cause.message : "Berita gagal disimpan.");
        if (textSaved) setNotice("Teks sudah tersimpan. Perubahan foto belum dikonfirmasi. Muat ulang untuk memeriksa foto di server, atau coba simpan lagi.");
      }
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function deletePost() {
    if (!post || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await request(`/staff/posts/${post.id}`, { method: "DELETE" });
      // Disable dirty guard before full navigation after successful delete.
      setValue(saved); setFile(null); setRemoveCover(false); setPost(null);
      setNotice("Berita dihapus.");
      dialog.current?.close();
    } catch (cause) {
      dialog.current?.close();
      if (!(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Berita gagal dihapus.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  if (loading) return <p role="status">Memuat berita…</p>;
  if (!can(user, "media:manage")) return <div><p className="error-box" role="alert">{error || "Halaman ini tidak tersedia untuk peran Anda."}</p><Link className="btn btn-secondary" href="/admin/">Kembali ke panel Anda</Link></div>;
  if (notice === "Berita dihapus.") return <div><p role="status">{notice}</p><Link className="btn" href="/admin/berita/">Kembali ke daftar berita</Link></div>;
  if (id && !post) return <div><p className="error-box" role="alert">{error}</p><button className="btn" onClick={() => { setLoading(true); setError(""); setAttempt((n) => n + 1); }}>Muat ulang</button><Link className="btn btn-secondary" href="/admin/berita/">Kembali ke daftar berita</Link></div>;
  const cover = file ? localCover : removeCover ? null : post?.cover_url;
  return <div className={styles.editor}>
    <Link className="btn btn-secondary" href="/admin/berita/">Kembali ke daftar berita</Link>
    <div ref={message} tabIndex={-1}>{error && <p className="error-box" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>
    <div className={styles.actions}><NewsStatus status={post?.status ?? "draft"} />{dirty && <span>Perubahan belum disimpan</span>}{post?.status === "published" && <a className="btn btn-secondary" href={`/berita/baca/?slug=${encodeURIComponent(post.slug)}`} target="_blank" rel="noopener noreferrer">Lihat di website</a>}</div>
    {post?.status === "published" && <p>Tautan website disiapkan untuk halaman publik CMS (C4), yang belum tersedia.</p>}
    <form onSubmit={(event) => { event.preventDefault(); void save(post?.status ?? "draft"); }}>
      <fieldset className={styles.fields} disabled={busy}>
        <legend className="sr-only">Isi berita</legend>
        <div className={styles.field}><label htmlFor="post-title">Judul</label><input id="post-title" required maxLength={160} value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} /></div>
        <div className={styles.field}><label htmlFor="post-category">Kategori</label><select id="post-category" value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value as StaffPostInput["category"] })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="post-summary">Ringkasan</label><textarea id="post-summary" required rows={3} maxLength={300} aria-describedby="summary-count" value={value.summary} onChange={(e) => setValue({ ...value, summary: e.target.value })} /><span id="summary-count">{value.summary.length}/300 karakter</span></div>
        <div className={styles.field}><label htmlFor="post-body">Isi</label><span id="body-help">Pisahkan paragraf dengan baris kosong</span><textarea id="post-body" required rows={14} maxLength={20000} aria-describedby="body-help" value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} /></div>
        <div className={styles.field}><label htmlFor="post-cover">Foto sampul {post?.cover_url || file ? "(ganti foto)" : "(opsional)"}</label><input ref={input} id="post-cover" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="cover-help" onChange={(e) => { const selected = e.target.files?.[0] ?? null; setFile(selected); setLocalCover(selected ? URL.createObjectURL(selected) : null); setRemoveCover(false); }} />
          <p id="cover-help">JPG, PNG, atau WebP, maksimal 3 MB; lebar 600–6.000 dan tinggi 400–6.000 piksel. Foto diunggah setelah teks tersimpan. Sampul dapat diakses publik, termasuk saat berita masih draf. Jangan unggah dokumen pribadi.</p>
          {cover && <Image className={styles.cover} src={cover} alt="Pratinjau foto sampul" width={800} height={500} unoptimized />}
          {(cover || file) && <button type="button" className="btn btn-secondary" onClick={() => { setFile(null); setRemoveCover(!!post?.cover_url); if (input.current) input.current.value = ""; }}>Hapus foto</button>}
          {removeCover && <p>Foto akan dihapus saat berita disimpan.</p>}
        </div>
        <div className={styles.actions}>
          {post?.status !== "published" && <button className="btn btn-secondary" type="submit">Simpan draf</button>}
          <button className="btn" type="button" onClick={() => void save("published")}>{post?.status === "published" ? "Simpan perubahan" : "Terbitkan"}</button>
          {post?.status === "published" && <button className="btn btn-secondary" type="button" onClick={() => void save("draft")}>Kembalikan ke draf</button>}
          <button className="btn btn-secondary" type="button" aria-expanded={preview} aria-controls="post-preview" onClick={() => setPreview(!preview)}>{preview ? "Tutup pratinjau" : "Pratinjau"}</button>
        </div>
      </fieldset>
    </form>
    {busy && <p role="status">Menyimpan perubahan…</p>}
    {preview && <section id="post-preview" className={styles.preview} aria-label="Pratinjau berita"><p>Pratinjau — belum tentu sudah tersimpan</p><h2>{value.title || "Judul berita"}</h2><p>{categoryLabels[value.category]} · {postDate(post?.published_at ?? null)}</p><NewsArticle summary={value.summary} body={value.body} coverUrl={cover} /></section>}
    {post && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => dialog.current?.showModal()}>Hapus berita</button>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="delete-title" onCancel={(event) => { if (busy) event.preventDefault(); }}><h2 id="delete-title">Hapus berita</h2><p>Berita akan dihapus dari website. Lanjutkan?</p><div className={styles.actions}><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dialog.current?.close()} autoFocus>Batal</button><button type="button" className="btn" disabled={busy} onClick={() => void deletePost()}>Ya, hapus berita</button></div></dialog>
  </div>;
}

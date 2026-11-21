"use client";
/* eslint-disable @next/next/no-img-element -- Pratinjau foto API dapat berasio apa pun, tanpa crop. */

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { socialPlatforms, type StaffPostDetail, type StaffPostImage, type PostStatus } from "@/types/posts";
import { isSocialLink, socialPlatformInfo } from "@/lib/social-links";
import { NewsArticle } from "@/features/news/news-article";
import { prepareImageForUpload } from "@/lib/image-compress";
import { siteHref } from "@/lib/urls";
import { can, useAdminSession } from "./session";
import { AdminUnauthorizedError } from "./api";
import { categoryLabels, parsePost, postDate, postInputSchema, type PostFormValue } from "./news-data";
import { NewsStatus } from "./news-list";
import styles from "./news.module.css";
import { useUnsavedChanges } from "./use-unsaved-changes";

const empty: PostFormValue = {
  title: "", category: "kegiatan_desa", summary: "", body: "", status: "draft",
  show_copyright: false, instagram_url: "", tiktok_url: "", youtube_url: "", facebook_url: "",
};
const MAX_INLINE_IMAGES = 3;
const PARAGRAPH_SPLIT = /\r?\n[\t ]*\r?\n/;
/** Foto dipilih sebelum disimpan; diunggah berurutan setelah teks tersimpan (seperti foto sampul). */
type PendingImage = { key: number; file: File; url: string; caption: string };
/** Sama dengan NewsArticle: foto ke-n setelah paragraf ke-n; bila paragraf kurang, di akhir berita. */
function placement(position: number, paragraphs: number) {
  return position <= paragraphs ? `Tampil setelah paragraf ${position}` : "Tampil di akhir berita (paragraf belum cukup)";
}
// Penjagaan navigasi dipakai bersama editor bagian situs.
function fields(post: StaffPostDetail): PostFormValue {
  return {
    title: post.title, category: post.category, summary: post.summary, body: post.body, status: post.status,
    show_copyright: post.show_copyright, instagram_url: post.instagram_url ?? "", tiktok_url: post.tiktok_url ?? "",
    youtube_url: post.youtube_url ?? "", facebook_url: post.facebook_url ?? "",
  };
}
function captionMap(images: StaffPostImage[]): Record<number, string> {
  return Object.fromEntries(images.map((image) => [image.id, image.caption ?? ""])) as Record<number, string>;
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
  const [value, setValue] = useState<PostFormValue>(empty);
  const [saved, setSaved] = useState<PostFormValue>(empty);
  const [loading, setLoading] = useState(!!id);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [localCover, setLocalCover] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const pendingRef = useRef<PendingImage[]>([]);
  const pendingKey = useRef(0);
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState(false);
  // Tahun pratinjau hak cipta untuk berita yang belum terbit; dibaca sekali agar render tetap murni.
  const [openedAt] = useState(() => Date.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const message = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const images = post?.images ?? [];
  const captionsDirty = images.some((image) => (captions[image.id] ?? "") !== (image.caption ?? ""));
  const dirty = JSON.stringify(value) !== JSON.stringify(saved) || !!file || removeCover || pending.length > 0 || captionsDirty;
  useUnsavedChanges(dirty || busy);

  useEffect(() => {
    if (!id || !can(user, "media:manage")) return;
    let cancelled = false;
    void request<unknown>(id ? `/staff/posts/${id}` : "/staff/posts").then(parsePost).then((result) => {
      if (!cancelled) { setPost(result); setValue(fields(result)); setSaved(fields(result)); setCaptions(captionMap(result.images)); }
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Gagal memuat berita.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, request, attempt, user]);
  useEffect(() => {
    return () => { if (localCover) URL.revokeObjectURL(localCover); };
  }, [localCover]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  // URL pratinjau foto antrean dilepas saat editor ditutup.
  useEffect(() => () => { pendingRef.current.forEach((item) => URL.revokeObjectURL(item.url)); }, []);
  useEffect(() => { if (error || notice) message.current?.focus(); }, [error, notice]);

  function adopt(result: StaffPostDetail) {
    setPost(result); setValue(fields(result)); setSaved(fields(result));
    // Pertahankan ketikan keterangan yang belum disimpan; hapus entri foto yang sudah dihapus.
    setCaptions((previous) => Object.fromEntries(
      result.images.map((image) => [image.id, previous[image.id] ?? image.caption ?? ""]),
    ) as Record<number, string>);
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
        const data = new FormData(); data.append("file", await prepareImageForUpload(file));
        result = parsePost(await request<unknown>(`/staff/posts/${result.id}/cover`, { method: "POST", body: data }));
        adopt(result); setFile(null); if (input.current) input.current.value = "";
      } else if (removeCover) {
        result = parsePost(await request<unknown>(`/staff/posts/${result.id}/cover`, { method: "DELETE" }));
        adopt(result);
      }
      setRemoveCover(false);
      let uploaded = 0;
      for (const item of pending) {
        const data = new FormData();
        data.append("file", await prepareImageForUpload(item.file));
        if (item.caption.trim()) data.append("caption", item.caption.trim());
        result = parsePost(await request<unknown>(`/staff/posts/${result.id}/images`, { method: "POST", body: data }));
        adopt(result); uploaded++;
        // Foto yang sudah terunggah keluar dari antrean; sisanya tetap bila unggahan berikutnya gagal.
        URL.revokeObjectURL(item.url);
        setPending((previous) => previous.filter((entry) => entry.key !== item.key));
      }
      setNotice((result.status === "published" ? "Berita terbit berhasil disimpan." : "Draf berhasil disimpan.") + (uploaded ? ` ${uploaded} foto tambahan terunggah.` : ""));
    } catch (cause) {
      if (!(cause instanceof AdminUnauthorizedError)) {
        setError(cause instanceof Error ? cause.message : "Berita gagal disimpan.");
        if (textSaved) setNotice("Teks sudah tersimpan. Perubahan foto belum dikonfirmasi; foto yang belum terunggah masih ada di daftar. Coba simpan lagi, atau muat ulang untuk memeriksa foto di server.");
      }
    } finally { inFlight.current = false; setBusy(false); }
  }
  function choosePhotos(list: FileList | null) {
    const selected = [...(list ?? [])];
    if (imageInput.current) imageInput.current.value = "";
    if (!selected.length) return;
    const room = MAX_INLINE_IMAGES - images.length - pending.length;
    const accepted = selected.filter((photo) => ["image/jpeg", "image/png", "image/webp"].includes(photo.type));
    const added = accepted.slice(0, Math.max(0, room));
    const skipped = selected.length - added.length;
    setNotice("");
    setError(skipped ? (room <= 0 ? "Batas 3 foto tambahan sudah tercapai." : accepted.length < selected.length
      ? `${selected.length - accepted.length} file bukan JPG, PNG, atau WebP dan tidak dipilih.` : `Maksimal 3 foto tambahan per berita; ${skipped} foto tidak dipilih.`) : "");
    if (added.length) setPending((previous) => [...previous, ...added.map((photo) => ({ key: ++pendingKey.current, file: photo, url: URL.createObjectURL(photo), caption: "" }))]);
  }
  function removePending(key: number) {
    setPending((previous) => previous.filter((item) => { if (item.key === key) URL.revokeObjectURL(item.url); return item.key !== key; }));
  }
  async function saveCaption(image: StaffPostImage) {
    if (!post || inFlight.current) return;
    const caption = (captions[image.id] ?? "").trim();
    if (caption === (image.caption ?? "")) { setNotice("Keterangan foto tidak berubah."); return; }
    const postId = post.id;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = parsePost(await request<unknown>(`/staff/posts/${postId}/images/${image.id}`, {
        method: "PATCH", body: JSON.stringify({ caption: caption || null }),
      }));
      adopt(result);
      setNotice("Keterangan foto disimpan.");
    } catch (cause) {
      if (!(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Keterangan foto gagal disimpan.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function deleteImage(image: StaffPostImage) {
    if (!post || inFlight.current) return;
    if (!window.confirm("Hapus foto tambahan ini dari berita? Tindakan ini tidak dapat dibatalkan.")) return;
    const postId = post.id;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = parsePost(await request<unknown>(`/staff/posts/${postId}/images/${image.id}`, { method: "DELETE" }));
      adopt(result);
      setNotice("Foto tambahan dihapus.");
    } catch (cause) {
      if (!(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Foto tambahan gagal dihapus.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function deletePost() {
    if (!post || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await request(`/staff/posts/${post.id}`, { method: "DELETE" });
      // Disable dirty guard before full navigation after successful delete.
      setValue(saved); setFile(null); setRemoveCover(false); setPost(null); pending.forEach((item) => URL.revokeObjectURL(item.url)); setPending([]); setCaptions({});
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
  const paragraphCount = value.body.split(PARAGRAPH_SPLIT).filter((paragraph) => paragraph.trim()).length;
  const previewImages = [
    ...images.map((image) => ({ url: image.url, caption: image.caption })),
    ...pending.map((item) => ({ url: item.url, caption: item.caption.trim() || null })),
  ].slice(0, MAX_INLINE_IMAGES);
  return <div className={styles.editor}>
    <Link className="btn btn-secondary" href="/admin/berita/">Kembali ke daftar berita</Link>
    <div ref={message} tabIndex={-1}>{error && <p className="error-box" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>
    <div className={styles.actions}><NewsStatus status={post?.status ?? "draft"} />{dirty && <span>Perubahan belum disimpan</span>}{post?.status === "published" && <a className="btn btn-secondary" href={siteHref(`/berita/baca/?slug=${encodeURIComponent(post.slug)}`)} target="_blank" rel="noopener noreferrer">Lihat di website<span className="sr-only"> (dibuka di tab baru)</span></a>}</div>
    <form onSubmit={(event) => { event.preventDefault(); void save(post?.status ?? "draft"); }}>
      <fieldset className={styles.fields} disabled={busy}>
        <legend className="sr-only">Isi berita</legend>
        <div className={styles.field}><label htmlFor="post-title">Judul</label><input id="post-title" required maxLength={160} value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} /></div>
        <div className={styles.field}><label htmlFor="post-category">Kategori</label><select id="post-category" value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value as PostFormValue["category"] })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="post-summary">Ringkasan</label><textarea id="post-summary" required rows={3} maxLength={300} aria-describedby="summary-count" value={value.summary} onChange={(e) => setValue({ ...value, summary: e.target.value })} /><span id="summary-count">{value.summary.length}/300 karakter</span></div>
        <div className={styles.field}><label htmlFor="post-body">Isi</label><span id="body-help">Pisahkan paragraf dengan baris kosong. Foto di dalam berita disisipkan otomatis setelah paragraf pertama, kedua, dan ketiga.</span><textarea id="post-body" required rows={14} maxLength={20000} aria-describedby="body-help" value={value.body} onChange={(e) => setValue({ ...value, body: e.target.value })} /></div>
        <div className={styles.field}><label htmlFor="post-cover">Foto sampul {post?.cover_url || file ? "(ganti foto)" : "(opsional)"}</label><input ref={input} id="post-cover" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="cover-help" onChange={(e) => { const selected = e.target.files?.[0] ?? null; setFile(selected); setLocalCover(selected ? URL.createObjectURL(selected) : null); setRemoveCover(false); }} />
          <p id="cover-help">Format JPG, PNG, atau WebP; ukuran maksimal 10 MB. Foto besar otomatis diperkecil di browser, dan sisi terpanjang hasil akhir 2.000 piksel dengan rasio asli tanpa dipotong. Sampul dapat diakses publik, termasuk saat berita masih draf. Jangan unggah dokumen pribadi.</p>
          {cover && <Image className={styles.cover} src={cover} alt="Pratinjau foto sampul" width={800} height={500} unoptimized />}
          {(cover || file) && <button type="button" className="btn btn-secondary" onClick={() => { setFile(null); setRemoveCover(!!post?.cover_url); if (input.current) input.current.value = ""; }}>Hapus foto</button>}
          {removeCover && <p>Foto akan dihapus saat berita disimpan.</p>}
        </div>
        <div className={styles.field}>
          <h3 className={styles.subhead}>Foto di dalam berita (opsional, maks. 3)</h3>
          <p id="inline-images-help">Pilih 1–3 foto sekaligus. Foto pertama tampil setelah paragraf pertama, foto kedua setelah paragraf kedua, dan foto ketiga setelah paragraf ketiga. Foto terpilih diunggah saat Anda menekan Simpan draf atau Terbitkan. JPG, PNG, atau WebP, maksimal 10 MB per foto; foto besar diperkecil otomatis dengan rasio asli tanpa dipotong.</p>
          {images.length + pending.length === 0 && <p>Belum ada foto di dalam berita.</p>}
          {images.map((image, index) => <div key={image.id} className={styles.inlineImage}>
            <img className={styles.inlinePhoto} src={image.url} alt={image.caption || `Foto tambahan ${index + 1}`} loading="lazy" />
            <p className={styles.placement}>Foto {index + 1} · {placement(index + 1, paragraphCount)} · tersimpan</p>
            <div className={styles.field}>
              <label htmlFor={`post-image-caption-${image.id}`}>Keterangan foto {index + 1} (opsional)</label>
              <input id={`post-image-caption-${image.id}`} maxLength={200} value={captions[image.id] ?? ""} onChange={(e) => setCaptions({ ...captions, [image.id]: e.target.value })} aria-describedby="inline-caption-help" />
            </div>
            <div className={styles.actions}>
              <button type="button" className="btn btn-secondary" disabled={busy || (captions[image.id] ?? "") === (image.caption ?? "")} onClick={() => void saveCaption(image)}>Simpan keterangan</button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void deleteImage(image)}>Hapus foto</button>
            </div>
          </div>)}
          {pending.map((item, index) => {
            const position = images.length + index + 1;
            return <div key={item.key} className={styles.inlineImage}>
              <img className={styles.inlinePhoto} src={item.url} alt={item.caption.trim() || `Pratinjau foto ${position}`} />
              <p className={styles.placement}>Foto {position} · {placement(position, paragraphCount)} · belum diunggah</p>
              <div className={styles.field}>
                <label htmlFor={`post-pending-caption-${item.key}`}>Keterangan foto {position} (opsional)</label>
                <input id={`post-pending-caption-${item.key}`} maxLength={200} value={item.caption} aria-describedby="inline-caption-help"
                  onChange={(e) => { const caption = e.target.value; setPending((previous) => previous.map((entry) => entry.key === item.key ? { ...entry, caption } : entry)); }} />
              </div>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => removePending(item.key)}>Batalkan foto ini</button>
            </div>;
          })}
          <span id="inline-caption-help">Keterangan membantu pembaca layar dan tampil di bawah foto. Kosongkan bila tidak perlu.</span>
          {images.length + pending.length >= MAX_INLINE_IMAGES ? <p>Batas 3 foto di dalam berita sudah tercapai.</p> : <div className={styles.field}>
            <label htmlFor="post-image">{images.length + pending.length === 0 ? "Pilih foto (bisa beberapa sekaligus)" : `Tambah foto (sisa ${MAX_INLINE_IMAGES - images.length - pending.length})`}</label>
            <input ref={imageInput} id="post-image" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-describedby="inline-images-help" onChange={(e) => choosePhotos(e.target.files)} />
          </div>}
          {pending.length > 0 && <p role="status">{pending.length} foto akan diunggah saat berita disimpan.</p>}
        </div>
        <label className={styles.check}><input type="checkbox" checked={value.show_copyright} aria-describedby="post-copyright-help" onChange={(e) => setValue({ ...value, show_copyright: e.target.checked })} />Tampilkan © KIM Desa Watuagung di akhir berita</label>
        <span id="post-copyright-help">Opsional. Bila dicentang, berita ini menampilkan &quot;© {"{tahun terbit}"} KIM Desa Watuagung&quot; di bawah isi berita.</span>
        <div className={styles.field}>
          <h3 className={styles.subhead}>Media sosial (opsional)</h3>
          <p id="post-social-help">Tempel tautan unggahan berita yang sama di media sosial desa. Kosongkan bila tidak ada; hanya tautan yang diisi yang tampil sebagai tombol &quot;Lihat di Instagram/TikTok/YouTube/Facebook&quot; di halaman berita, seperti tombol Chat WhatsApp pada UMKM.</p>
          {socialPlatforms.map((platform) => {
            const column = `${platform}_url` as const;
            const { label, example } = socialPlatformInfo[platform];
            const invalid = value[column].trim() !== "" && !isSocialLink(platform, value[column].trim());
            return <div key={platform} className={styles.field}>
              <label htmlFor={`post-${platform}`}>Tautan {label} (opsional)</label>
              <span id={`post-${platform}-help`}>Contoh: {example}</span>
              <input id={`post-${platform}`} type="url" inputMode="url" maxLength={500} placeholder="https://" aria-invalid={invalid} aria-describedby={`post-${platform}-help post-social-help${invalid ? ` post-${platform}-error` : ""}`} value={value[column]} onChange={(e) => setValue({ ...value, [column]: e.target.value })} />
              {invalid && <span id={`post-${platform}-error`} className={styles.fieldError}>Tautan harus diawali https:// dan mengarah ke {socialPlatformInfo[platform].hosts[0]}.</span>}
            </div>;
          })}
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
    {preview && <section id="post-preview" className={styles.preview} aria-label="Pratinjau berita"><p>Pratinjau — belum tentu sudah tersimpan</p><h2>{value.title || "Judul berita"}</h2><p>{categoryLabels[value.category]} · {postDate(post?.published_at ?? null)}</p><NewsArticle title={value.title || "Judul berita"} summary={value.summary} body={value.body} coverUrl={cover} images={previewImages}
      copyrightYear={value.show_copyright ? Number(new Date(post?.published_at ?? openedAt).toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Jakarta" })) : null}
      socialLinks={socialPlatforms.flatMap((platform) => { const url = value[`${platform}_url`].trim(); return url && isSocialLink(platform, url) ? [{ platform, label: socialPlatformInfo[platform].label, url }] : []; })} /></section>}
    {post && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => dialog.current?.showModal()}>Hapus berita</button>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="delete-title" onCancel={(event) => { if (busy) event.preventDefault(); }}><h2 id="delete-title">Hapus berita</h2><p>Berita akan dihapus dari website. Foto sampul dan foto tambahannya ikut dihapus dan tidak dapat dikembalikan. Lanjutkan?</p><div className={styles.actions}><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dialog.current?.close()} autoFocus>Batal</button><button type="button" className="btn" disabled={busy} onClick={() => void deletePost()}>Ya, hapus berita</button></div></dialog>
  </div>;
}

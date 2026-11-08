"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { NewsCover } from "@/components/news-cover";
import { businessCategoryLabels, businessHref, emptyBusinessPage, listBusinesses, type BusinessPage } from "@/services/businesses";
import { isDemo } from "@/services/pelayanan";
import { businessCategories, type BusinessCategory, type PublicBusiness } from "@/types/business";

export function BusinessCard({ item, index }: { item: PublicBusiness; index: number }) {
  return <Link className="news-card" href={businessHref(item.slug)}>
    {/* Tanpa foto: kotak polos, bukan pola foto ilustrasi berita yang bisa dikira foto usaha. */}
    {item.photo_url ? <NewsCover title={item.name} url={item.photo_url} index={index} />
      : <div className="news-cover umkm-no-photo" aria-hidden="true"><Store size={48} strokeWidth={1.5} /></div>}
    <div className="news-body">
      <div className="news-meta">{item.category_label}{item.hamlet && <span>Dusun {item.hamlet}</span>}</div>
      <h3>{item.name}</h3>
      <p className="news-summary">{item.description}</p>
      <span className="text-link">Lihat usaha <ArrowRight size={16} aria-hidden="true" /></span>
    </div>
  </Link>;
}

/** /umkm: filter kategori sebagai tombol, kartu berfoto, Muat lebih banyak. Demo/tanpa API: keadaan kosong. */
export function PublicBusinesses() {
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [page, setPage] = useState<BusinessPage | null>(isDemo ? emptyBusinessPage : null);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (!isDemo) void listBusinesses(1, category ?? undefined).then((result) => { if (active) setPage(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [category, attempt]);

  async function more(current: BusinessPage) {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    try {
      const result = await listBusinesses(current.current_page + 1, category ?? undefined);
      if (mounted.current) setPage({ ...result, data: [...current.data, ...result.data.filter((item) => !current.data.some((old) => old.slug === item.slug))] });
    } catch { if (mounted.current) setError(true); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  }
  function choose(next: BusinessCategory | null) {
    if (next === category) return;
    setCategory(next); setPage(isDemo ? emptyBusinessPage : null); setError(false); setLoading(!isDemo);
  }

  return <section className="section container umkm-page" aria-busy={loading}>
    <div className="umkm-filters" role="group" aria-label="Filter kategori usaha">
      {([null, ...businessCategories] as const).map((value) => <button key={value ?? "semua"} type="button"
        className={`btn ${value === category ? "" : "btn-secondary"}`} aria-pressed={value === category} onClick={() => choose(value)}>
        {value ? businessCategoryLabels[value] : "Semua"}
      </button>)}
    </div>
    {page?.data.length ? <>
      <p className="news-count" role="status">{page.total} usaha{category ? ` · ${businessCategoryLabels[category]}` : ""}</p>
      <div className="news-grid">{page.data.map((item, index) => <BusinessCard key={item.slug} item={item} index={index} />)}</div>
    </> : page && !loading && !error ? <div className="content-grid"><article className="content-card">
      <h2>{category ? `Belum ada UMKM pada kategori ${businessCategoryLabels[category]}.` : "Belum ada UMKM yang ditampilkan."}</h2>
      <p>Daftar usaha warga ditampilkan di sini setelah didata Pemerintah Desa Watuagung. Pemilik usaha yang ingin didaftarkan dapat menghubungi kantor desa.</p>
      <Link className="btn btn-secondary" href="/kontak">Kontak kantor desa</Link>
    </article></div> : null}
    <div className="news-load-state" aria-live="polite">
      {loading && <p role="status">Memuat UMKM…</p>}
      {error && <><p role="alert">UMKM belum dapat dimuat</p><button className="btn" onClick={() => { setError(false); if (page?.data.length) void more(page); else { setLoading(true); setAttempt((n) => n + 1); } }}>Coba lagi</button></>}
      {!loading && !error && page && page.current_page < page.last_page && <button className="btn" onClick={() => void more(page)}>Muat lebih banyak</button>}
    </div>
  </section>;
}

/** Kartu "UMKM Watuagung" beranda: 3 terbit terbaru; kosong/galat/demo tetap "Segera hadir". */
export function HomeBusinesses() {
  const [items, setItems] = useState<PublicBusiness[]>([]);
  useEffect(() => {
    let active = true;
    if (!isDemo) void listBusinesses(1, undefined, "latest").then((result) => { if (active) setItems(result.data.slice(0, 3)); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <article className="home-economy-card home-umkm">
    <h2>UMKM Watuagung</h2>
    {items.length ? <>
      <p>Usaha warga yang baru ditambahkan:</p>
      <ul className="home-umkm-list">{items.map((item) => <li key={item.slug}>
        <Link href={businessHref(item.slug)}><strong>{item.name}</strong><span>{item.category_label}{item.hamlet ? ` · Dusun ${item.hamlet}` : ""}</span></Link>
      </li>)}</ul>
      <Link href="/umkm" className="home-bottom-link">Lihat semua UMKM <ArrowRight size={22} aria-hidden="true" /></Link>
    </> : <>
      <p>Daftar produk warga sedang disiapkan.</p>
      <span className="home-bottom-badge">Segera hadir</span>
      <Link href="/potensi" className="home-bottom-link">Lihat potensi desa <ArrowRight size={22} aria-hidden="true" /></Link>
    </>}
  </article>;
}

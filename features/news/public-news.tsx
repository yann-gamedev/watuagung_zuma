"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NewsCard, NoOfficialNews } from "@/components/site";
import { NewsCover } from "@/components/news-cover";
import { initialNewsPage, listPosts, newsHref, type NewsPage } from "@/services/posts";
import { isDemo } from "@/services/pelayanan";

export function PublicNews({ home = false }: { home?: boolean }) {
  const [page, setPage] = useState<NewsPage | null>(initialNewsPage);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  async function load(number: number) {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await listPosts(number);
      if (mounted.current) setPage((previous) => ({ ...result, data: number === 1 ? result.data : [...(previous?.data ?? []), ...result.data.filter((item) => !previous?.data.some((old) => old.slug === item.slug))] }));
    } catch { if (mounted.current) setError(true); }
    finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (!isDemo) void listPosts(1).then((result) => { if (active) setPage(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, []);

  if (home) {
    if (!page?.data.length || error) return null;
    return (
      <section className="container home-bottom-container home-bottom home-news" aria-labelledby="news-title">
        <div className="home-news-heading">
          <h2 id="news-title">Kabar desa</h2>
          <Link href="/berita" className="home-bottom-link">Semua berita <ArrowRight size={22} aria-hidden="true" /></Link>
        </div>
        <div className="home-news-grid">
          {page.data.slice(0, 3).map((item, index) => (
            <Link className="home-news-card" href={newsHref(item.slug)} key={item.slug}>
              <NewsCover title={item.title} url={item.coverUrl} index={index} />
              <div className="home-news-body">
                <p className="home-news-meta">{item.category} · {item.date}</p>
                <h3>{item.title}</h3>
              </div>
            </Link>
          ))}
        </div>
        {page.data.some((item) => item.sample) && <p className="home-news-note">Konten contoh untuk pratinjau website.</p>}
      </section>
    );
  }
  return (
    <section className="section container" aria-busy={loading}>
      {page?.data.length ? <>
        <div className="news-intro-row">
          <p className="news-intro-copy">Ikuti kabar kegiatan warga, perkembangan desa, layanan, dan inisiatif ekonomi lokal.</p>
          <span className="news-count">{page.total} berita</span>
        </div>
        {page.data.some((item) => item.sample) && <div className="notice news-sample-notice">
          <strong>Konten contoh</strong>
          <span>Seluruh berita di halaman ini adalah materi ilustrasi untuk pratinjau desain, bukan informasi resmi yang telah diverifikasi.</span>
        </div>}
        <div className="news-grid">{page.data.map((item, index) => <NewsCard key={item.slug} item={item} index={index} />)}</div>
      </> : !loading && !error ? <NoOfficialNews /> : null}
      <div className="news-load-state" aria-live="polite">
        {loading && <p role="status">Memuat berita…</p>}
        {error && <><p role="alert">Berita belum dapat dimuat</p><button className="btn" onClick={() => { setLoading(true); setError(false); void load(page ? page.current_page + 1 : 1); }}>Coba lagi</button></>}
        {!loading && !error && page && page.current_page < page.last_page && <button className="btn" onClick={() => { setLoading(true); void load(page.current_page + 1); }}>Muat lebih banyak</button>}
      </div>
    </section>
  );
}

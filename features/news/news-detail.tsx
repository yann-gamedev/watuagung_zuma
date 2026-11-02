"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/site";
import { NewsArticle } from "@/features/news/news-article";
import { getPost, type NewsDetail } from "@/services/posts";

export function NewsDetailPage() {
  const slug = useSearchParams().get("slug") ?? "";
  return <Detail key={slug} slug={slug} />;
}
function Detail({ slug }: { slug: string }) {
  const [post, setPost] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    document.title = "Berita Desa | Desa Watuagung";
    if (slug) void getPost(slug).then((result) => {
      if (!active) return;
      setPost(result);
      document.title = `${result?.title ?? "Berita tidak ditemukan"} | Desa Watuagung`;
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, attempt]);
  return <>
    <PageHeading eyebrow={post?.category ?? "KABAR WATUAGUNG"} title={post?.title ?? "Berita Desa"}
      intro={post?.date ?? "Cerita kegiatan, pembangunan, dan kebersamaan warga."}
      parent={{ label: "Berita Desa", href: "/berita" }} />
    <section className="section container" aria-busy={loading}>
      {loading ? <p role="status">Memuat berita…</p> : error ? <div role="alert">
        <p>Berita belum dapat dimuat</p>
        <button className="btn" onClick={() => { setError(false); setLoading(true); setAttempt(attempt + 1); }}>Coba lagi</button>
      </div> : post ? <NewsArticle {...post} /> : <h2>Berita tidak ditemukan</h2>}
      <Link href="/berita" className="text-link article-back-link">← Kembali ke berita desa</Link>
    </section>
  </>;
}

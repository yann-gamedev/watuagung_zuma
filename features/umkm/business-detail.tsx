"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Store } from "lucide-react";
import { NewsCover } from "@/components/news-cover";
import { PageHeading } from "@/components/site";
import { getBusiness, whatsappHref } from "@/services/businesses";
import type { PublicBusiness } from "@/types/business";

export function BusinessDetailPage() {
  const slug = useSearchParams().get("slug") ?? "";
  return <Detail key={slug} slug={slug} />;
}

function Detail({ slug }: { slug: string }) {
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    document.title = "UMKM Watuagung | Desa Watuagung";
    if (slug) void getBusiness(slug).then((result) => {
      if (!active) return;
      setBusiness(result);
      document.title = `${result?.name ?? "UMKM tidak ditemukan"} | Desa Watuagung`;
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, attempt]);
  const chat = business ? whatsappHref(business) : null;
  const back = <Link href="/umkm" className="text-link article-back-link">← Kembali ke daftar UMKM</Link>;
  return <>
    <PageHeading editorial eyebrow={business?.category_label.toUpperCase() ?? "UMKM WARGA"} title={business?.name ?? "UMKM Watuagung"}
      intro={business ? (business.hamlet ? `Dusun ${business.hamlet}` : "Usaha warga Desa Watuagung") : "Usaha warga Desa Watuagung."}
      parent={{ label: "UMKM", href: "/umkm" }} />
    <section className="section container" aria-busy={loading}>
      {loading ? <p role="status">Memuat UMKM…</p> : error ? <div role="alert">
        <p>UMKM belum dapat dimuat</p>
        <button className="btn" onClick={() => { setError(false); setLoading(true); setAttempt(attempt + 1); }}>Coba lagi</button>
      </div> : business ? <article className="article-body umkm-detail">
        {/* Pola artikel berita: foto, ringkasan fakta, isi, tombol, tautan kembali. Tanpa foto: kotak polos ikon toko. */}
        {business.photo_url ? <NewsCover title={`Foto ${business.name}`} url={business.photo_url} className="article-image-frame" />
          : <div className="news-cover article-image-frame umkm-no-photo" aria-hidden="true"><Store size={56} strokeWidth={1.5} /></div>}
        <dl className="umkm-detail-facts">
          <div><dt>Kategori</dt><dd>{business.category_label}</dd></div>
          {business.hamlet && <div><dt>Dusun</dt><dd>{business.hamlet}</dd></div>}
          {business.owner_name && <div><dt>Pemilik</dt><dd>{business.owner_name}</dd></div>}
        </dl>
        <div className="article-copy">{business.description.split(/\r?\n\s*\r?\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        {chat ? <a className="btn umkm-chat" href={chat} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={22} aria-hidden="true" />Chat WhatsApp<span className="sr-only"> (dibuka di tab baru)</span>
        </a> : <div className="article-endnote">Kontak pemilik tidak ditampilkan. Untuk informasi usaha ini, hubungi kantor desa.</div>}
        {back}
      </article> : <h2>UMKM tidak ditemukan</h2>}
      {!business && !loading && back}
    </section>
  </>;
}

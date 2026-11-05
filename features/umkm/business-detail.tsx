"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
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
  return <>
    <PageHeading eyebrow={business?.category_label.toUpperCase() ?? "UMKM WARGA"} title={business?.name ?? "UMKM Watuagung"}
      intro={business ? (business.hamlet ? `Dusun ${business.hamlet}` : "Usaha warga Desa Watuagung") : "Usaha warga Desa Watuagung."}
      parent={{ label: "UMKM", href: "/umkm" }} />
    <section className="section container" aria-busy={loading}>
      {loading ? <p role="status">Memuat UMKM…</p> : error ? <div role="alert">
        <p>UMKM belum dapat dimuat</p>
        <button className="btn" onClick={() => { setError(false); setLoading(true); setAttempt(attempt + 1); }}>Coba lagi</button>
      </div> : business ? <article className="umkm-detail">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto API dinamis pada static export */}
        {business.photo_url && <img className="umkm-detail-photo" src={business.photo_url} alt={`Foto ${business.name}`} />}
        <div className="umkm-detail-body">
          {business.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <dl className="umkm-detail-facts">
            <div><dt>Kategori</dt><dd>{business.category_label}</dd></div>
            {business.hamlet && <div><dt>Dusun</dt><dd>{business.hamlet}</dd></div>}
            {business.owner_name && <div><dt>Pemilik</dt><dd>{business.owner_name}</dd></div>}
          </dl>
          {chat ? <a className="btn" href={chat} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={22} aria-hidden="true" />Chat WhatsApp<span className="sr-only"> (dibuka di tab baru)</span>
          </a> : <p>Kontak pemilik tidak ditampilkan. Untuk informasi usaha ini, hubungi kantor desa.</p>}
        </div>
      </article> : <h2>UMKM tidak ditemukan</h2>}
      <Link href="/umkm" className="text-link article-back-link umkm-back-link">← Kembali ke daftar UMKM</Link>
    </section>
  </>;
}

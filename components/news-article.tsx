import type { ReactNode } from "react";
import Image from "next/image";

export type NewsArticleProps = {
  summary: string;
  body: string;
  coverUrl?: string | null;
  sample?: boolean;
  children?: ReactNode;
};

export function NewsArticle({
  summary,
  body,
  coverUrl,
  sample = false,
  children,
}: NewsArticleProps) {
  const imageUrl = sample ? "/village.jpg" : coverUrl;

  return (
    <article className="article-body">
      {sample && (
        <div className="notice article-sample-notice">
          <strong>Artikel contoh</strong>
          <span>Konten ilustrasi untuk pratinjau website. Bukan laporan kegiatan resmi dan belum diverifikasi.</span>
        </div>
      )}
      {imageUrl && (
        <figure className="article-image">
          <div className="article-image-frame">
            <Image
              src={imageUrl}
              alt={sample ? "Petani menanam padi di sawah" : "Foto sampul berita"}
              fill
              sizes="(max-width: 820px) 100vw, 780px"
              preload={sample}
              unoptimized={!sample}
            />
          </div>
          {sample && (
            <figcaption>Foto ilustrasi suasana pertanian desa, bukan dokumentasi kegiatan dalam artikel.</figcaption>
          )}
        </figure>
      )}
      <p className="article-lead">{summary}</p>
      <div className="article-copy">
        {body.split(/\r?\n[\t ]*\r?\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {sample && (
        <div className="article-endnote">Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa.</div>
      )}
      {children}
    </article>
  );
}

import { Fragment, type ReactNode } from "react";

export type NewsArticleProps = {
  summary: string;
  body: string;
  coverUrl?: string | null;
  images?: { url: string; caption: string | null }[];
  sample?: boolean;
  children?: ReactNode;
};

export function NewsArticle({
  summary,
  body,
  coverUrl,
  images = [],
  sample = false,
  children,
}: NewsArticleProps) {
  const imageUrl = sample ? "/village.jpg" : coverUrl;
  const paragraphs = body.split(/\r?\n[\t ]*\r?\n/).filter((paragraph) => paragraph.trim());
  const inline = images.slice(0, 3);

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
            {/* eslint-disable-next-line @next/next/no-img-element -- Sampul API mempertahankan rasio asli. */}
            <img
              src={imageUrl}
              alt={sample ? "Petani menanam padi di sawah" : "Foto sampul berita"}
              loading={sample ? "eager" : "lazy"}
            />
          </div>
          {sample && (
            <figcaption>Foto ilustrasi suasana pertanian desa, bukan dokumentasi kegiatan dalam artikel.</figcaption>
          )}
        </figure>
      )}
      <p className="article-lead">{summary}</p>
      <div className="article-copy">
        {paragraphs.map((paragraph, index) => (
          <Fragment key={index}>
            <p>{paragraph}</p>
            {inline[index] && <InlineImage image={inline[index]} index={index} />}
          </Fragment>
        ))}
        {inline.slice(paragraphs.length).map((image, index) => (
          <InlineImage key={`extra-${index}`} image={image} index={paragraphs.length + index} />
        ))}
      </div>
      {sample && (
        <div className="article-endnote">Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa.</div>
      )}
      {children}
    </article>
  );
}

function InlineImage({ image, index }: { image: { url: string; caption: string | null }; index: number }) {
  return (
    <figure className="article-inline-image">
      {/* eslint-disable-next-line @next/next/no-img-element -- Foto API mempertahankan rasio asli, tanpa crop. */}
      <img src={image.url} alt={image.caption ?? `Foto tambahan ${index + 1}`} loading="lazy" />
      {image.caption && <figcaption>{image.caption}</figcaption>}
    </figure>
  );
}

import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { NewsCover } from "@/components/news-cover";
import type { NewsSocialLink } from "@/services/posts";

export type ArticleImage = { url: string; caption: string | null };

function InlineImage({ image, index }: { image: ArticleImage; index: number }) {
  return <figure className="article-inline-image">
    {/* eslint-disable-next-line @next/next/no-img-element -- Foto API mempertahankan rasio asli, tanpa crop. */}
    <img src={image.url} alt={image.caption ?? `Foto tambahan ${index + 1}`} loading="lazy" />
    {image.caption && <figcaption>{image.caption}</figcaption>}
  </figure>;
}

export function NewsArticle({ title, summary, body, coverUrl = null, sample = false, images = [], copyrightYear = null, socialLinks = [], children }: {
  title: string; summary: string; body: string; coverUrl?: string | null; sample?: boolean;
  images?: ArticleImage[];
  /** Diisi bila berita memilih menampilkan hak cipta KIM; tahun terbit (WIB). */
  copyrightYear?: number | null;
  socialLinks?: NewsSocialLink[];
  children?: ReactNode;
}) {
  const paragraphs = body.split(/\r?\n[\t ]*\r?\n/).filter((paragraph) => paragraph.trim());
  const inline = images.slice(0, 3);
  return <article className="article-body">
    {sample && <div className="notice article-sample-notice"><strong>Konten contoh</strong><span>Konten ilustrasi untuk pratinjau website. Bukan laporan kegiatan resmi dan belum diverifikasi.</span></div>}
    <NewsCover title={title} url={coverUrl} className="article-image-frame" />
    <p className="article-lead">{summary}</p>
    <div className="article-copy">
      {paragraphs.map((paragraph, index) => <Fragment key={index}>
        <p>{paragraph}</p>
        {inline[index] && <InlineImage image={inline[index]} index={index} />}
      </Fragment>)}
      {inline.slice(paragraphs.length).map((image, index) => <InlineImage key={`extra-${index}`} image={image} index={paragraphs.length + index} />)}
    </div>
    {copyrightYear !== null && <p className="article-copyright">© {copyrightYear} KIM Desa Watuagung</p>}
    {socialLinks.length > 0 && <section className="article-social" aria-labelledby="article-social-title">
      <h2 id="article-social-title">Lihat juga di</h2>
      <div className="article-social-links">
        {socialLinks.map((link) => <a key={link.platform} className="btn btn-secondary" href={link.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={20} aria-hidden="true" />{link.label}<span className="sr-only"> (dibuka di tab baru)</span>
        </a>)}
      </div>
    </section>}
    {sample && <div className="article-endnote">Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa.</div>}
    {children}
  </article>;
}

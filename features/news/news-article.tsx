import type { ReactNode } from "react";
import { NewsCover } from "@/components/news-cover";

export function NewsArticle({ title, summary, body, coverUrl = null, sample = false, children }: {
  title: string; summary: string; body: string; coverUrl?: string | null; sample?: boolean; children?: ReactNode;
}) {
  return <article className="article-body">
    {sample && <div className="notice article-sample-notice"><strong>Konten contoh</strong><span>Konten ilustrasi untuk pratinjau website. Bukan laporan kegiatan resmi dan belum diverifikasi.</span></div>}
    <NewsCover title={title} url={coverUrl} className="article-image-frame" />
    <p className="article-lead">{summary}</p>
    <div className="article-copy">{body.split(/\r?\n[\t ]*\r?\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {sample && <div className="article-endnote">Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa.</div>}
    {children}
  </article>;
}

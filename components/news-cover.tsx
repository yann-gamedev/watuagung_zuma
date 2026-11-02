/* eslint-disable @next/next/no-img-element -- Sampul API memakai img native untuk static export. */
export function NewsCover({ title, url, index = 0, className = "" }: {
  title: string; url: string | null; index?: number; className?: string;
}) {
  return url ? (
    <div className={`news-cover ${className}`}>
      <img src={url} alt={title} loading="lazy" />
    </div>
  ) : <div className={`news-cover news-art art-${index % 3} ${className}`} aria-hidden="true" />;
}

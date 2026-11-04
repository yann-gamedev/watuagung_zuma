"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Sprout, MapPin, Landmark, Wheat, House, HandHeart } from "lucide-react";
import { PageHeading } from "@/components/site";
import { ProfileInstitutionChips } from "@/components/profile-institution-chips";
import { getSiteSection } from "@/services/site";
import type { SiteProfile } from "@/types/site";

export function SiteTextPage({ sectionKey, initialPage }: {
  sectionKey: "profile" | "history";
  initialPage: SiteProfile & { title: string; eyebrow: string };
}) {
  const [data, setData] = useState<SiteProfile | null>(null);

  useEffect(() => {
    let active = true;
    getSiteSection(sectionKey).then((result) => {
      if (active && result) setData(result);
    });
    return () => { active = false; };
  }, [sectionKey]);

  const page = { ...initialPage, ...data };
  const details = data?.profileDetails ?? initialPage.profileDetails;
  const firstBlock = page.blocks[0] ?? initialPage.blocks[0];
  // ponytail: teks bawaan dipotong agar tidak mengulang chip tema; teks hasil suntingan tampil utuh.
  const lead = firstBlock.text === initialPage.blocks[0].text ? firstBlock.text.split(" Pertanian,")[0] : firstBlock.text;

  return (
    <>
      <PageHeading {...page} />
      <section className="section container info-page">
        {sectionKey === "profile" && details ? (
          <div className="content-grid profile-bento">
            <article className="content-card profile-card profile-growth">
              <h2><Sprout aria-hidden="true" />{firstBlock.title}</h2>
              <p className="profile-lead">{lead}</p>
              <ul className="profile-themes">
                {details.themes.map((theme, index) => {
                  const Icon = [Wheat, House, HandHeart][index] ?? Sprout;
                  return <li key={`${index}-${theme}`}><Icon aria-hidden="true" />{theme}</li>;
                })}
              </ul>
            </article>
            <article className="content-card profile-card profile-region">
              <h2><MapPin aria-hidden="true" />{page.blocks[1]?.title ?? initialPage.blocks[1]?.title}</h2>
              <div className="profile-region-location">
                <h3 className="sr-only">Lokasi</h3>
                <p className="profile-location">{details.location}</p>
              </div>
              <div id="village-map" className="profile-map-placeholder" role="region" aria-label="Peta interaktif Desa Watuagung">
                <iframe
                  className="profile-map-frame"
                  title="Peta interaktif area Desa Watuagung, Prigen"
                  src="https://maps.google.com/maps?q=Desa%20Watuagung%2C%20Prigen%2C%20Pasuruan%2C%20Jawa%20Timur&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <a className="profile-map-link" href="https://www.google.com/maps/search/?api=1&query=Desa%20Watuagung%2C%20Prigen%2C%20Pasuruan%2C%20Jawa%20Timur" target="_blank" rel="noopener noreferrer">Buka peta lebih besar <ExternalLink size={15} aria-hidden="true" /><span className="sr-only"> (dibuka di tab baru)</span></a>
              <dl className="profile-area-row"><div><dt>Luas wilayah</dt><dd>Sedang dikonfirmasi</dd></div></dl>
              <dl className="profile-key-figures">
                {details.stats.map((stat, index) => <div key={`${index}-${stat.label}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
              </dl>
              <p className="profile-hamlet-names">{details.stats.find((stat) => stat.label === "Dusun")?.detail}</p>
              <div className="profile-region-bounds">
                <h3>Batas wilayah</h3>
                <dl className="profile-boundaries">
                  {details.boundaries.map((item) => <div key={item.direction}><dt>{item.direction}</dt><dd>{item.place}</dd></div>)}
                </dl>
              </div>
              <small className="profile-source profile-region-source">{details.source}</small>
            </article>
            <article className="content-card profile-card profile-institutions">
              <h2><Landmark aria-hidden="true" />{page.blocks[2]?.title ?? initialPage.blocks[2]?.title}</h2>
              <ProfileInstitutionChips key={JSON.stringify(details.institutions)} items={details.institutions} />
              <small className="profile-source">{details.source}</small>
            </article>
            {page.blocks.slice(3).map((block, index) => (
              <article className="content-card" key={`${index}-${block.title}`}>
                <h2>{block.title}</h2>
                <p>{block.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="content-grid">
            {page.blocks.map((block, index) => (
              <article className="content-card" key={`${index}-${block.title}`}>
                <h2>{block.title}</h2>
                <p>{block.text}</p>
              </article>
            ))}
          </div>
        )}
        {sectionKey === "profile" && (
          <div className="button-row mt-8">
            {[
              ["Sejarah Desa", "sejarah"],
              ["Visi dan Misi", "visi-misi"],
              ["Struktur Pemerintahan", "struktur-pemerintahan"],
              ["Statistik Desa", "statistik"],
            ].map(([title, target]) => (
              <Link className="btn btn-secondary" href={"/" + target} key={target}>
                {title}
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

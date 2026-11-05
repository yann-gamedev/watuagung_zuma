"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Sprout, MapPin, Landmark, Wheat, House, HandHeart, ScrollText } from "lucide-react";
import { PageHeading } from "@/components/site";
import { ProfileInstitutionChips } from "@/components/profile-institution-chips";
import { SiteVideo } from "@/components/site-video";
import { getSiteSection } from "@/services/site";
import type { SiteProfile } from "@/types/site";

type ParsedLeader = {
  name: string;
  period: string;
  role?: string;
  isCurrent?: boolean;
};

function parseLeaderEntry(line: string): { isSource: boolean; text?: string; leader?: ParsedLeader } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^sumber:/i.test(trimmed)) {
    return { isSource: true, text: trimmed };
  }
  const match = trimmed.match(/^(.*?)\s*\(([^()]+)\)$/);
  if (match) {
    const rawName = match[1].trim();
    const period = match[2].trim();
    let name = rawName;
    let role = "";
    if (rawName.includes(", Petinggi pendiri desa")) {
      name = rawName.replace(", Petinggi pendiri desa", "").trim();
      role = "Petinggi Pendiri Desa";
    } else if (rawName.endsWith(", Pj.")) {
      name = rawName.replace(/,\s*Pj\.$/, "").trim();
      role = "Penjabat (Pj.)";
    }
    const isCurrent = /2024.*2031/.test(period) || /sekarang|aktif|kini/i.test(period);
    return {
      isSource: false,
      leader: { name, period, role, isCurrent },
    };
  }
  return {
    isSource: false,
    leader: { name: trimmed, period: "", role: "", isCurrent: false },
  };
}

function HistoryView({
  blocks,
  initialBlocks,
}: {
  blocks: { title: string; text: string }[];
  initialBlocks: { title: string; text: string }[];
}) {
  const storyBlock = blocks[0] ?? initialBlocks[0];
  const hamletBlock = blocks[1] ?? initialBlocks[1];
  const leadersBlock = blocks[2] ?? initialBlocks[2];
  const extraBlocks = blocks.slice(3);

  const leaderLines = leadersBlock ? leadersBlock.text.split("\n").map(parseLeaderEntry).filter(Boolean) : [];
  const parsedLeaders: ParsedLeader[] = [];
  let leaderSource = "";
  for (const item of leaderLines) {
    if (item?.isSource && item.text) {
      leaderSource = item.text;
    } else if (item?.leader) {
      parsedLeaders.push(item.leader);
    }
  }

  const currentLeader = parsedLeaders.find((l) => l.isCurrent);
  const historicalLeaders = parsedLeaders.filter((l) => !l.isCurrent);

  return (
    <div className="history-layout">
      {/* Grid Atas: Cerita Asal-usul + Tiga Dusun */}
      <div className="history-top-grid">
        {storyBlock && (
          <article className="content-card profile-card history-card history-story-card">
            <div className="history-story-content">
              <h2>
                <ScrollText aria-hidden="true" />
                {storyBlock.title}
              </h2>
              <p className="history-story-lead">{storyBlock.text}</p>
            </div>
            <div className="history-highlights" aria-label="Sorotan sejarah Watuagung">
              <div className="history-highlight-item">
                <span className="history-highlight-label">Tokoh Pendiri</span>
                <span className="history-highlight-value">Mbah Singo &amp; Mbah Gambir</span>
              </div>
              <div className="history-highlight-item">
                <span className="history-highlight-label">Babat Alas</span>
                <span className="history-highlight-value">Watudukun (Watuagung)</span>
              </div>
              <div className="history-highlight-item">
                <span className="history-highlight-label">Asal Nama</span>
                <span className="history-highlight-value">Batu Besar &amp; Beringin</span>
              </div>
            </div>
          </article>
        )}

        {hamletBlock && (
          <article className="content-card profile-card history-card history-hamlets-card">
            <div>
              <h2>
                <MapPin aria-hidden="true" />
                {hamletBlock.title}
              </h2>
              <p className="history-hamlets-lead">{hamletBlock.text}</p>
            </div>
            <ul className="history-hamlet-list" aria-label="Tiga dusun bersejarah">
              <li className="history-hamlet-item">
                <div className="history-hamlet-badge" aria-hidden="true">
                  <MapPin size={18} />
                </div>
                <div className="history-hamlet-content">
                  <strong>Dusun Watuagung</strong>
                  <p>Pusat sejarah berdirinya desa di sekitar batu besar penanda Watuagung.</p>
                </div>
              </li>
              <li className="history-hamlet-item">
                <div className="history-hamlet-badge" aria-hidden="true">
                  <MapPin size={18} />
                </div>
                <div className="history-hamlet-content">
                  <strong>Dusun Talang</strong>
                  <p>Bagian dari tiga pemukiman historis pembuka wilayah desa.</p>
                </div>
              </li>
              <li className="history-hamlet-item">
                <div className="history-hamlet-badge" aria-hidden="true">
                  <MapPin size={18} />
                </div>
                <div className="history-hamlet-content">
                  <strong>Dusun Sekar</strong>
                  <p>Bagian dari tiga pemukiman historis pembuka wilayah desa.</p>
                </div>
              </li>
            </ul>
          </article>
        )}
      </div>

      {/* Bagian Kepala Desa Dari Masa ke Masa */}
      {leadersBlock && (
        <article className="content-card profile-card history-card history-leaders-card">
          <div className="history-leaders-header">
            <div>
              <h2>
                <Landmark aria-hidden="true" />
                {leadersBlock.title}
              </h2>
              <p className="history-leaders-desc">
                Catatan kepemimpinan desa yang berkesinambungan sejak masa berdirinya desa hingga periode berjalan saat ini.
              </p>
            </div>
            {parsedLeaders.length > 0 && (
              <div className="history-period-count" aria-label={`Total ${parsedLeaders.length} periode tercatat`}>
                <span className="history-count-number">{parsedLeaders.length}</span>
                <span className="history-count-label">Periode Tercatat</span>
              </div>
            )}
          </div>

          {currentLeader && (
            <div className="history-current-leader" aria-label={`Kepala Desa saat ini: ${currentLeader.name}`}>
              <div className="history-current-left">
                <div className="history-current-badge">
                  <span className="history-pulse" aria-hidden="true" />
                  <span>Kepala Desa Saat Ini</span>
                </div>
                <h3 className="history-current-name">{currentLeader.name}</h3>
              </div>
              <span className="history-current-period">{currentLeader.period}</span>
            </div>
          )}

          {historicalLeaders.length > 0 ? (
            <div className="history-timeline-grid" role="list" aria-label="Daftar kepala desa terdahulu">
              {historicalLeaders.map((leader, index) => {
                const number = String(index + 1).padStart(2, "0");
                return (
                  <div className="history-timeline-item" role="listitem" key={`${index}-${leader.name}`}>
                    <span className="history-item-number" aria-hidden="true">{number}</span>
                    <div className="history-item-body">
                      <strong className="history-item-name">{leader.name}</strong>
                      <div className="history-item-meta">
                        <span className="history-item-period">{leader.period}</span>
                        {leader.role && (
                          <span className="history-item-role">{leader.role}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="whitespace-pre-line">{leadersBlock.text}</p>
          )}

          {leaderSource && (
            <small className="history-source">{leaderSource}</small>
          )}
        </article>
      )}

      {/* Blok tambahan (bila ditambahkan lewat admin CMS) */}
      {extraBlocks.map((block, index) => (
        <article className="content-card profile-card history-card" key={`${index}-${block.title}`}>
          <h2>{block.title}</h2>
          <p>{block.text}</p>
        </article>
      ))}
    </div>
  );
}

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
        {sectionKey === "profile" && <SiteVideo slot="profile" heading="Video profil desa" />}
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
        ) : sectionKey === "history" ? (
          <HistoryView blocks={page.blocks} initialBlocks={initialPage.blocks} />
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
        {(sectionKey === "profile" || sectionKey === "history") && (
          <div className="button-row mt-8">
            {[
              sectionKey === "profile"
                ? ["Sejarah Desa", "sejarah"]
                : ["Profil Desa", "profil"],
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

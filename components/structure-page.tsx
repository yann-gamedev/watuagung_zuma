"use client";

import { useEffect, useState } from "react";
import { Award, FileText, Layers, MapPin, Users, Landmark, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/site";
import { ProfileLinks } from "@/components/profile-links";
import { getSiteEnvelope, type SiteEnvelope } from "@/services/site";
import type { SiteStructure } from "@/types/site";

type StructureItem = {
  role: string;
  person: string;
  members?: string[];
  isMultiple?: boolean;
};

type ParsedBlock = {
  type: "kades" | "category";
  title: string;
  name?: string;
  term?: string;
  items?: StructureItem[];
  sourceNote?: string;
  rawText?: string;
};

function expandRoleTitle(role: string): string {
  const trimmed = role.trim();
  // Kaur -> Kepala Urusan
  if (/^kaur\s+/i.test(trimmed)) {
    return trimmed.replace(/^kaur\s+/i, "Kepala Urusan ");
  }
  // Kasi -> Kepala Seksi
  if (/^kasi\s+/i.test(trimmed)) {
    return trimmed.replace(/^kasi\s+/i, "Kepala Seksi ");
  }
  return trimmed;
}

function parseStructureBlock(block: { title: string; text: string }): ParsedBlock {
  let text = block.text;
  let sourceNote = "";

  // Pisahkan catatan sumber bila tercantum di akhir teks (misal pada BPD)
  const sourceMatch = text.match(/(?:Sumber susunan di halaman ini:\s*|Sumber:\s*)(.+)$/i);
  if (sourceMatch) {
    sourceNote = sourceMatch[0].trim();
    text = text.slice(0, sourceMatch.index).trim();
    text = text.replace(/[•·.\s]+$/, "");
  }

  // Khusus blok Kepala Desa
  const isKades = /kepala desa/i.test(block.title);
  if (isKades) {
    const parts = text.split(/[•·\n]+/).map((p) => p.trim()).filter(Boolean);
    const name = parts[0] || text;
    const term = parts[1] || "";
    return {
      type: "kades",
      title: block.title,
      name,
      term,
      sourceNote,
      rawText: block.text,
    };
  }

  // Pisahkan baris / butir
  const rawParts = text.split(/[•·\n]+/).map((p) => p.trim()).filter(Boolean);
  const items: StructureItem[] = [];

  for (const part of rawParts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx !== -1) {
      const rawRole = part.slice(0, colonIdx).trim();
      const role = expandRoleTitle(rawRole);
      const person = part.slice(colonIdx + 1).trim();
      if (/^anggota/i.test(rawRole) && person.includes(",")) {
        const members = person.split(",").map((m) => m.trim()).filter(Boolean);
        items.push({ role, person, members, isMultiple: true });
      } else {
        items.push({ role, person, isMultiple: false });
      }
    } else {
      items.push({ role: "", person: part, isMultiple: false });
    }
  }

  return {
    type: "category",
    title: block.title,
    items,
    sourceNote,
    rawText: block.text,
  };
}

function getCategoryIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("sekretariat")) return FileText;
  if (lower.includes("teknis")) return Layers;
  if (lower.includes("kewilayahan") || lower.includes("dusun")) return MapPin;
  if (lower.includes("permusyawaratan") || lower.includes("bpd")) return Users;
  return Landmark;
}

function getCategorySubtitle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("sekretariat")) {
    return "Unsur pembantu pimpinan dalam ketatausahaan, keuangan, perencanaan, dan pelayanan umum.";
  }
  if (lower.includes("teknis")) {
    return "Unsur pembantu pimpinan pelaksana operasional di bidang pemerintahan dan pelayanan warga.";
  }
  if (lower.includes("kewilayahan")) {
    return "Unsur pembantu Kepala Desa sebagai pelaksana tugas di wilayah kerja masing-masing dusun.";
  }
  if (lower.includes("permusyawaratan") || lower.includes("bpd")) {
    return "Lembaga permusyawaratan yang menampung dan menyalurkan aspirasi masyarakat desa.";
  }
  return "";
}

export function StructurePage({
  initialPage,
}: {
  initialPage: {
    title: string;
    eyebrow: string;
    intro: string;
    blocks: SiteStructure["blocks"];
    source?: string;
  };
}) {
  const [state, setState] = useState<SiteEnvelope<"structure"> | null>(null);

  useEffect(() => {
    let active = true;
    getSiteEnvelope("structure").then((result) => {
      if (active && result) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const data = state?.data ?? { blocks: initialPage.blocks, source: initialPage.source };
  const parsed = data.blocks.map(parseStructureBlock);
  const kadesBlock = parsed.find((b) => b.type === "kades");
  const categories = parsed.filter((b) => b.type === "category");

  return (
    <>
      <PageHeading
        {...initialPage}
        visual={
          <div className="structure-heading-visual" aria-hidden="true">
            <div className="structure-heading-emblem">
              <ShieldCheck />
            </div>
          </div>
        }
      />
      <section className="section container info-page">
        {state?.data.chartImagePath && state.imageUrl && (
          <figure className="structure-chart-card">
            <div className="structure-chart-header">
              <div className="structure-chart-badge">
                <Landmark size={18} aria-hidden="true" />
                <span>Bagan Struktur Organisasi</span>
              </div>
              <a
                className="btn btn-secondary"
                href={state.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Perbesar gambar<span className="sr-only"> (dibuka di tab baru)</span>
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- gambar API dinamis pada static export */}
            <img
              src={state.imageUrl}
              alt={state.data.chartAlt || "Bagan Struktur Pemerintahan Desa Watuagung"}
              className="structure-chart-img"
            />
            {state.data.chartAlt && (
              <figcaption className="structure-chart-caption">{state.data.chartAlt}</figcaption>
            )}
          </figure>
        )}

        <div className="structure-layout">
          {/* Kartu Utama: Kepala Desa */}
          {kadesBlock && (
            <article className="structure-card structure-kades-card" aria-label="Pimpinan Pemerintahan Desa">
              <div className="structure-kades-content">
                <div className="structure-kades-top">
                  <div className="structure-kades-badge">
                    <span className="structure-pulse" aria-hidden="true" />
                    <span>Pimpinan Pemerintahan Desa</span>
                  </div>
                  {kadesBlock.term && (
                    <span className="structure-kades-term">{kadesBlock.term}</span>
                  )}
                </div>

                <div className="structure-kades-main">
                  <div className="structure-kades-text">
                    <span className="structure-kades-role">{kadesBlock.title}</span>
                    <h2 className="structure-kades-name">{kadesBlock.name}</h2>
                    <p className="structure-kades-desc">
                      Memimpin penyelenggaraan pemerintahan desa, pembinaan kemasyarakatan, serta pemberdayaan masyarakat Desa Watuagung.
                    </p>
                  </div>

                  <div className="structure-kades-emblem" aria-hidden="true">
                    <div className="structure-emblem-ring">
                      <Award />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Grid Kategori Perangkat Desa */}
          <div className="structure-grid">
            {categories.map((cat, idx) => {
              const Icon = getCategoryIcon(cat.title);
              const subtitle = getCategorySubtitle(cat.title);
              return (
                <article
                  className="structure-card structure-category-card"
                  key={`${idx}-${cat.title}`}
                >
                  <div>
                    <div className="structure-category-header">
                      <div className="structure-category-icon" aria-hidden="true">
                        <Icon size={22} />
                      </div>
                      <div>
                        <h2>{cat.title}</h2>
                        {subtitle && (
                          <p className="structure-category-subtitle">{subtitle}</p>
                        )}
                      </div>
                    </div>

                    {cat.items && cat.items.length > 0 ? (
                      <ul
                        className="structure-person-list"
                        aria-label={`Daftar ${cat.title}`}
                      >
                        {cat.items.map((item, itemIdx) => {
                          if (item.isMultiple && item.members) {
                            return (
                              <li
                                className="structure-person-item structure-person-multiple"
                                key={itemIdx}
                              >
                                <div className="structure-person-role-wrap">
                                  <span className="structure-role-badge">
                                    {item.role}
                                  </span>
                                </div>
                                <div className="structure-members-chips">
                                  {item.members.map((member, mIdx) => (
                                    <span className="structure-member-chip" key={mIdx}>
                                      {member}
                                    </span>
                                  ))}
                                </div>
                              </li>
                            );
                          }

                          return (
                            <li className="structure-person-item" key={itemIdx}>
                              {item.role && (
                                <div className="structure-person-role-wrap">
                                  <span className="structure-role-badge">
                                    {item.role}
                                  </span>
                                </div>
                              )}
                              <span className="structure-person-name">
                                {item.person}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="structure-raw-text">{cat.rawText}</p>
                    )}
                  </div>

                  {cat.sourceNote && (
                    <small className="structure-card-source">{cat.sourceNote}</small>
                  )}
                </article>
              );
            })}
          </div>

          {/* Bagian Bawah: Sumber & Navigasi Antar Halaman Profil */}
          <div className="structure-footer-section">
            {data.source && (
              <p className="structure-source">{data.source}</p>
            )}
            <ProfileLinks current="struktur-pemerintahan" />
          </div>
        </div>
      </section>
    </>
  );
}

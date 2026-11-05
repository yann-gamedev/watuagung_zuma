"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/site";
import { getSiteEnvelope, type SiteEnvelope } from "@/services/site";
import type { SiteStructure } from "@/types/site";

export function StructurePage({ initialPage }: { initialPage: { title: string; eyebrow: string; intro: string; blocks: SiteStructure["blocks"]; source?: string } }) {
  const [state, setState] = useState<SiteEnvelope<"structure"> | null>(null);
  useEffect(() => {
    let active = true;
    getSiteEnvelope("structure").then((result) => { if (active && result) setState(result); });
    return () => { active = false; };
  }, []);
  const data = state?.data ?? { blocks: initialPage.blocks, source: initialPage.source };
  return <>
    <PageHeading {...initialPage} />
    <section className="section container info-page">
      {state?.data.chartImagePath && state.imageUrl && <figure className="content-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- gambar API dinamis pada static export */}
        <img src={state.imageUrl} alt={state.data.chartAlt} style={{ width: "100%", height: "auto" }} />
        <figcaption><a className="btn btn-secondary" href={state.imageUrl} target="_blank" rel="noopener noreferrer">Perbesar gambar<span className="sr-only"> (dibuka di tab baru)</span></a></figcaption>
      </figure>}
      <div className="content-grid">
        {data.blocks.map((block, index) => <article className="content-card" key={index}>
          <h2>{block.title}</h2><p>{block.text}</p>
        </article>)}
      </div>
      <p>{data.source}</p>
    </section>
  </>;
}

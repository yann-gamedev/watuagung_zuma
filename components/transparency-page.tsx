"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageHeading } from "@/components/site";
import { budgetTotals, formatRupiah } from "@/lib/transparency";
import { getSiteEnvelope } from "@/services/site";
import type { SiteBudget, SiteBudgetLine, SiteTransparency } from "@/types/site";

function Lines({ caption, lines, total }: { caption: string; lines: SiteBudgetLine[]; total?: number }) {
  return <div className="table-scroll budget-table" role="region" aria-label={caption} tabIndex={0}>
    <table>
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Uraian</th><th scope="col">Jumlah</th></tr></thead>
      <tbody>{lines.map((line, i) => <tr key={i}><td>{line.label}</td><td>{formatRupiah(line.amount)}</td></tr>)}</tbody>
      {total !== undefined && <tfoot><tr><th scope="row">Total</th><td>{formatRupiah(total)}</td></tr></tfoot>}
    </table>
  </div>;
}

function Budget({ budget, url }: { budget: SiteBudget; url?: string }) {
  const totals = budgetTotals(budget);
  return <article className="content-card budget-card" aria-labelledby={`apbdes-${budget.year}`}>
    <h2 id={`apbdes-${budget.year}`}>APBDes {budget.year} · {budget.status}</h2>
    <Lines caption="Pendapatan" lines={budget.revenue} total={totals.revenue} />
    <Lines caption="Belanja" lines={budget.spending} total={totals.spending} />
    {!!budget.financing?.length && <Lines caption="Pembiayaan" lines={budget.financing} />}
    <dl className="budget-summary">
      <div><dt>Total pendapatan</dt><dd>{formatRupiah(totals.revenue)}</dd></div>
      <div><dt>Total belanja</dt><dd>{formatRupiah(totals.spending)}</dd></div>
      <div><dt>{totals.surplus < 0 ? "Defisit" : "Surplus"}</dt><dd>{formatRupiah(Math.abs(totals.surplus))}</dd></div>
    </dl>
    <p className="source">{budget.source}</p>
    {url && <a className="btn btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
      <Download size={20} aria-hidden="true" />Unduh dokumen APBDes (PDF)<span className="sr-only"> (dibuka di tab baru)</span>
    </a>}
  </article>;
}

export function TransparencyPage({ initialPage }: { initialPage: { title: string; eyebrow: string; intro: string; blocks: SiteTransparency["programs"] } }) {
  const [state, setState] = useState<{ data: SiteTransparency; urls: Record<string, string> } | null>(null);

  useEffect(() => {
    let active = true;
    getSiteEnvelope("transparency").then((result) => {
      if (active && result) setState({ data: result.data, urls: result.documentUrls });
    });
    return () => { active = false; };
  }, []);

  const data = state?.data ?? { intro: initialPage.intro, programs: initialPage.blocks, budgets: [] };
  const budgets = [...data.budgets].sort((a, b) => b.year - a.year);
  return <>
    <PageHeading title={initialPage.title} eyebrow={initialPage.eyebrow} intro={data.intro} />
    <section className="section container info-page">
      <div className="content-grid">
        {data.programs.map((block, index) => <article className="content-card" key={`${index}-${block.title}`}>
          <h2>{block.title}</h2>
          <p>{block.text}</p>
        </article>)}
      </div>
      <div className="budget-list">
        {budgets.length ? budgets.map((budget) => <Budget key={budget.year} budget={budget} url={budget.documentPath && state?.urls[budget.documentPath]} />)
          : <p className="notice">APBDes resmi belum diunggah.</p>}
      </div>
    </section>
  </>;
}

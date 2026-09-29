"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Menu,
  X,

  Clock3,

  ChevronDown,
  Building2,
  House,
  HeartHandshake,
  ContactRound,
} from "lucide-react";
import { services, news } from "@/lib/data";
import type { Status } from "@/types/pelayanan";
const profileLinks = [["Profil Desa", "profil"], ["Sejarah Desa", "sejarah"], ["Visi dan Misi", "visi-misi"], ["Struktur Pemerintahan", "struktur-pemerintahan"]];
const informationLinks = [["Berita Desa", "berita"], ["Pengumuman", "pengumuman"], ["Agenda", "agenda"], ["Potensi Desa", "potensi"], ["Statistik Desa", "statistik"], ["Transparansi", "transparansi"]];
export function Wordmark({ subtitle = "Informasi & pelayanan desa" }: { subtitle?: string }) {
  return <span className="wordmark">Watuagung<small>{subtitle}</small></span>;
}
export function Navbar() {
  const [open, setOpen] = useState(false);
  const path = usePathname().replace(/\/$/, "") || "/";
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const active = (href: string) => path === href;
  function close() {
    setOpen(false);
    header.current?.querySelectorAll("details[open]").forEach((item) => item.removeAttribute("open"));
  }
  function group(label: string, links: string[][], id: string) {
    return <details name="main-navigation-dropdown" className={links.some(([, slug]) => path === "/" + slug || path.startsWith("/" + slug + "/")) ? "active-group" : ""}>
      <summary id={id}>{label}<ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="dropdown">{links.map(([title, slug]) => <Link key={slug} href={"/" + slug} aria-current={active("/" + slug) ? "page" : undefined} onClick={close}>{title}</Link>)}</div>
    </details>;
  }
  return <>
    <a href="#main" className="skip">Lewati ke konten</a>
    <header className="header site-header" ref={header}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        const details = (event.target as HTMLElement).closest("details");
        if (details?.open) { details.open = false; details.querySelector("summary")?.focus(); }
        else { close(); toggle.current?.focus(); }
      }}>
      <div className="container site-nav">
        <Link className="brand" href="/" onClick={close} aria-label="Watuagung, beranda"><Wordmark /></Link>
        <div className="nav-actions">
          <Link id="nav-status" className="nav-status" href="/pelayanan/status" aria-current={active("/pelayanan/status") ? "page" : undefined} onClick={close}>Cek Status</Link>
          <Link id="nav-apply" className="btn" href="/pelayanan" aria-current={active("/pelayanan") ? "page" : undefined} onClick={close}>Ajukan Surat</Link>
        </div>
        <button id="navigation-toggle" ref={toggle} className="navigation-toggle" aria-label={open ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={open} aria-controls="public-navigation" onClick={() => { if (open) close(); else setOpen(true); }}>
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}<span>Menu</span>
        </button>
        <nav id="public-navigation" className={"public-navigation" + (open ? " is-open" : "")} aria-label="Navigasi utama">
          <Link href="/" aria-current={active("/") ? "page" : undefined} onClick={close}>Beranda</Link>
          {group("Profil Desa", profileLinks, "nav-profile")}
          {group("Informasi", informationLinks, "nav-information")}
          <Link href="/kontak" aria-current={active("/kontak") ? "page" : undefined} onClick={close}>Kontak</Link>
        </nav>
      </div>
    </header>
  </>;
}
export function Footer() {
  return <footer className="site-footer">
    <div className="container footer-content">
      <div className="footer-identity">
        <Link className="brand" href="/"><Wordmark /></Link>
        <p>Prototipe website. Konten dan data publik masih berupa contoh, bukan informasi resmi desa.</p>
        <Link className="footer-contact" href="/kontak">Kontak dan jam pelayanan</Link>
        <p className="footer-note">Alamat, kontak, dan jam pelayanan resmi menunggu verifikasi.</p>
      </div>
      <nav aria-label="Profil desa di footer"><h2>Profil Desa</h2>{profileLinks.map(([title, slug]) => <Link key={slug} href={"/" + slug}>{title}</Link>)}</nav>
      <nav aria-label="Informasi di footer"><h2>Informasi</h2>{informationLinks.map(([title, slug]) => <Link key={slug} href={"/" + slug}>{title}</Link>)}</nav>
      <nav aria-label="Pelayanan di footer"><h2>Pelayanan</h2><Link href="/pelayanan">Ajukan Surat</Link><Link href="/pelayanan/status">Cek Status Pengajuan</Link><Link href="/admin">Panel Petugas</Link></nav>
    </div>
    <div className="container footer-credits">
      <span>© 2026 Watuagung · Website prototipe</span>
      <span>Foto ilustrasi: <a href="https://commons.wikimedia.org/wiki/File:Rice_terraces_in_Java_-_Indonesia.jpg">Thomas Fuhrmann</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · dipotong pada tampilan.</span>
    </div>
  </footer>;
}
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  href,
  link = "Lihat semua",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {link}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function ServiceCard({
  service,
}: {
  service: (typeof services)[number];
}) {
  const Icon = { Building2, House, HeartHandshake, ContactRound }[service.icon];
  return (
    <article className="service-card">
      <span className="icon-box">
        <Icon size={25} />
      </span>
      <h3>{service.title}</h3>
      <p>{service.description}</p>
      <div className="requirements">
        <strong>Persyaratan</strong>
        <ul>
          {service.requirements.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="service-bottom">
        <span>
          <Clock3 size={14} />
          {service.time}
        </span>
        <Link href={"/pelayanan/" + service.slug}>
          Ajukan <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function StatisticCard({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className="statistic">
      <span className="stat-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
export function NewsCard({
  item,
  index = 0,
}: {
  item: (typeof news)[number];
  index?: number;
}) {
  return (
    <Link className="news-card" href={"/berita/" + item.slug}>
      <div className={"news-art art-" + index}>
        <span>
          {index === 0
            ? "WARGA & LINGKUNGAN"
            : index === 1
              ? "KARYA DARI DESA"
              : "RUANG ASPIRASI"}
        </span>
        <span className="news-number">0{index + 1}</span>
      </div>
      <div className="news-body">
        <div className="news-meta">
          {item.category} <span>{item.date}</span>
        </div>
        <h3>{item.title}</h3>
        <span className="text-link">
          Baca selengkapnya <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}
export const statusLabels: Record<Status, string> = {
  SUBMITTED: "Pengajuan diterima",
  VERIFIED: "Terverifikasi",
  PROCESSING: "Sedang diproses",
  WAITING_APPROVAL: "Menunggu persetujuan",
  APPROVED: "Selesai / disetujui",
  REJECTED: "Ditolak",
  NEED_REVISION: "Perlu perbaikan",
};
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={"status-badge status-" + status}>
      {statusLabels[status]}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="page-heading">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Beranda</Link>
          <span>/</span>
          <span>{title}</span>
        </div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
    </div>
  );
}

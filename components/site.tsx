"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Clock3,
  Building2,
  House,
  HeartHandshake,
  ContactRound,
} from "lucide-react";
import { services, news } from "@/lib/data";
import type { Status } from "@/types/pelayanan";
import { SiteHeader, normalizePath } from "@/components/site-header";
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="footer-brand" href="/">
            <Image
              src="/brand/logo-watuagung-128.png"
              width={64}
              height={64}
              alt=""
            />
            <span>
              WATUAGUNG<small>PEMERINTAH DESA</small>
            </span>
          </Link>
          <p className="footer-contact">
            [ALAMAT KANTOR] · [TELEPON/WA] · [EMAIL]
          </p>
        </div>
        <nav className="footer-links" aria-label="Layanan di footer">
          <h3>Layanan</h3>
          <Link href="/pelayanan">Ajukan Surat</Link>
          <Link href="/pelayanan/status">Cek Status Surat</Link>
          <Link href="/kontak">
            Pengaduan <span className="footer-badge">Segera hadir</span>
          </Link>
        </nav>
        <nav className="footer-links" aria-label="Profil di footer">
          <h3>Profil</h3>
          <Link href="/profil">Profil Desa</Link>
          <Link href="/visi-misi">Visi &amp; Misi</Link>
          <Link href="/struktur-pemerintahan">Perangkat Desa</Link>
          <Link href="/transparansi">Transparansi</Link>
        </nav>
        <nav className="footer-links" aria-label="Info di footer">
          <h3>Info</h3>
          <Link href="/bumdes">BUMDes</Link>
          <Link href="/berita">Berita</Link>
          <Link href="/agenda">Agenda</Link>
          <Link href="/pengumuman">Pengumuman</Link>
          <Link href="/statistik">Statistik</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Pemerintah Desa Watuagung</span>
        <span>
          Foto hero:{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Rice_terraces_in_Java_-_Indonesia.jpg">
            Thomas Fuhrmann
          </a>{" "}
          ·{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">
            CC BY-SA 4.0
          </a>{" "}
          · dipotong
        </span>
        <p className="footer-disclaimer">
          Konten masih contoh, menunggu verifikasi desa.
        </p>
      </div>
    </footer>
  );
}
export function PublicShell({ children }: { children: ReactNode }) {
  const isHome = normalizePath(usePathname()) === "/";
  return (
    <>
      <SiteHeader />
      {/* Beranda: ruang header diberikan oleh .hero; halaman lain 72px. */}
      <main id="main" className={isHome ? undefined : "main-offset"}>
        {children}
      </main>
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

"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, FileCheck2, FileClock, CircleX, CircleAlert, UserCheck, ShieldCheck } from "lucide-react";
import { news, pages } from "@/lib/data";
import type { ServiceCode, Status } from "@/types/pelayanan";
import { requiresNeighborhoodApproval } from "@/lib/letter-workflow";
import { SiteHeader, normalizePath } from "@/components/site-header";
import { complaintFormUrl, complaintNote, externalLinkProps } from "@/lib/complaint";
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
            {pages.kontak.blocks[0].text} · [TELEPON/WA] · [EMAIL]
          </p>
        </div>
        <nav className="footer-links" aria-label="Layanan di footer">
          <h3>Layanan</h3>
          <Link href="/pelayanan">Ajukan Surat</Link>
          <Link href="/pelayanan/status">Cek Status Surat</Link>
          {complaintFormUrl ? (
            <a href={complaintFormUrl} {...externalLinkProps}>
              Sampaikan pengaduan <span className="footer-badge">Google Forms</span>
              <span className="sr-only"> ({complaintNote} Dibuka di tab baru.)</span>
            </a>
          ) : (
            <Link href="/kontak">
              Pengaduan <span className="footer-badge">Segera hadir</span>
            </Link>
          )}
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
      <div className={"news-art art-" + (index % 3)} aria-hidden="true" />
      <div className="news-body">
        <div className="news-meta">
          {item.category} <span>{item.date}</span>
        </div>
        <h3>{item.title}</h3>
        <p className="news-summary">{item.summary}</p>
        <span className="text-link">
          Baca selengkapnya <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}
export const statusLabels: Record<Status, string> = {
  SUBMITTED: "Diterima",
  RT_APPROVED: "Disetujui RT, menunggu RW",
  RW_APPROVED: "Pengantar RT/RW sah, menunggu kantor desa",
  VERIFIED: "Diverifikasi",
  PROCESSING: "Diproses",
  WAITING_APPROVAL: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  READY_FOR_PICKUP: "Siap diambil",
  COMPLETED: "Selesai",
  REJECTED: "Ditolak",
  NEED_REVISION: "Perlu perbaikan",
};
export const statusDescriptions: Record<Status, string> = {
  RT_APPROVED: "Ketua RT telah menyetujui. Permohonan menunggu pemeriksaan Ketua RW di wilayah Anda.",
  RW_APPROVED: "Ketua RT dan RW telah menyetujui. Permohonan menunggu verifikasi petugas kantor desa.",
  SUBMITTED: "Pengajuan telah diterima. Simpan bukti pengajuan dan cek status secara berkala untuk mengetahui hasil pemeriksaan petugas.",
  VERIFIED: "Data pengajuan telah diverifikasi. Cek status secara berkala untuk mengetahui proses penyiapan surat.",
  PROCESSING: "Surat sedang disiapkan. Cek kembali status pengajuan untuk mengetahui tahap berikutnya.",
  WAITING_APPROVAL: "Pengajuan menunggu persetujuan. Cek kembali status sebelum menghubungi kantor desa tentang pengambilan surat.",
  APPROVED: "Pengajuan disetujui. Surat atau PDF belum tersedia melalui website ini. Hubungi kantor desa untuk informasi selanjutnya; status ini belum berarti surat siap diambil.",
  READY_FOR_PICKUP: "Surat sudah siap. Ambil di kantor desa dengan membawa KTP asli dan nomor pengajuan.",
  COMPLETED: "Surat sudah diambil.",
  REJECTED: "Baca catatan petugas. Hubungi kantor desa untuk penjelasan dan arahan sebelum mengajukan kembali.",
  NEED_REVISION: "Hubungi kantor desa atau ajukan ulang dengan data yang diperbaiki. Perhatikan catatan petugas di bawah ini.",
};
const statusIcons = {
  SUBMITTED: ClipboardCheck,
  RT_APPROVED: UserCheck,
  RW_APPROVED: ShieldCheck,
  VERIFIED: FileCheck2,
  PROCESSING: FileClock,
  WAITING_APPROVAL: Clock3,
  APPROVED: CheckCircle2,
  READY_FOR_PICKUP: FileCheck2,
  COMPLETED: CheckCircle2,
  REJECTED: CircleX,
  NEED_REVISION: CircleAlert,
};
export function StatusBadge({ status, jenisSurat }: { status: Status; jenisSurat?: ServiceCode }) {
  const Icon = statusIcons[status];
  return (
    <span className={"status-badge status-" + status}>
      <Icon size={22} aria-hidden="true" />
      {status === "SUBMITTED" && requiresNeighborhoodApproval(jenisSurat) ? "Menunggu verifikasi RT" : statusLabels[status]}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  intro,
  visual,
  parent,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  visual?: ReactNode;
  parent?: { label: string; href: string };
}) {
  return (
    <div className="page-heading">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Beranda</Link>
          <span>/</span>
          {parent && (
            <>
              <Link href={parent.href}>{parent.label}</Link>
              <span>/</span>
            </>
          )}
          <span>{title}</span>
        </div>
        <div className={visual ? "page-heading-layout has-visual" : "page-heading-layout"}>
          <div className="page-heading-copy">
            <div className="eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
            <p>{intro}</p>
          </div>
          {visual && <div className="page-heading-visual" aria-hidden="true">{visual}</div>}
        </div>
      </div>
    </div>
  );
}

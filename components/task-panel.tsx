import Link from "next/link";
import { FileText, MessageSquare, Search } from "lucide-react";
import { complaintFormUrl, complaintNote, externalLinkProps } from "@/lib/complaint";

const tasks = [
  {
    title: "Ajukan Surat",
    description: "Domisili, usaha, SKTM, pengantar KTP/KK",
    href: "/pelayanan",
    icon: FileText,
    sand: false,
  },
  {
    title: "Cek Status Surat",
    description: "Masukkan nomor pengajuan dan kode akses",
    href: "/pelayanan/status",
    icon: Search,
    sand: false,
  },
  {
    title: "Sampaikan Pengaduan",
    description: complaintFormUrl
      ? `${complaintNote} Dibuka di tab baru.`
      : "Sementara, hubungi kantor desa langsung",
    href: complaintFormUrl || "/kontak",
    icon: MessageSquare,
    // Latar --sand tetap untuk pengaduan (DESIGN.md); badge hanya bila Google Form belum diisi.
    sand: true,
  },
];

export function TaskPanel() {
  return (
    <div className="container home-tasks">
      <nav className="task-panel" aria-label="Tugas utama warga">
        {tasks.map(({ title, description, href, icon: Icon, sand }) => {
          const external = !href.startsWith("/");
          const className = `task-link${sand ? " task-link-soon" : ""}`;
          const content = (
            <>
              <span className="task-icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <span className="task-copy">
                <strong>{title}</strong>
                {sand && !external && <span className="task-badge">Segera hadir</span>}
                <span className="task-description">{description}</span>
              </span>
            </>
          );
          return external ? (
            <a key={title} href={href} className={className} {...externalLinkProps}>
              {content}
            </a>
          ) : (
            <Link key={title} href={href} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>
      <p className="task-office-hours">
        Kantor desa buka [HARI &amp; JAM LAYANAN] · Bantuan: [NOMOR KANTOR]
      </p>
    </div>
  );
}

import Link from "next/link";
import { FileText, MessageSquare, Search } from "lucide-react";

const tasks = [
  {
    title: "Ajukan Surat",
    description: "Domisili, usaha, SKTM, pengantar KTP/KK",
    href: "/pelayanan",
    icon: FileText,
    comingSoon: false,
  },
  {
    title: "Cek Status Surat",
    description: "Masukkan nomor pengajuan dan kode akses",
    href: "/pelayanan/status",
    icon: Search,
    comingSoon: false,
  },
  {
    title: "Sampaikan Pengaduan",
    description: "Sementara, hubungi kantor desa langsung",
    href: "/kontak",
    icon: MessageSquare,
    comingSoon: true,
  },
];

export function TaskPanel() {
  return (
    <div className="container home-tasks">
      <nav className="task-panel" aria-label="Tugas utama warga">
        {tasks.map(({ title, description, href, icon: Icon, comingSoon }) => (
          <Link
            key={title}
            href={href}
            className={`task-link${comingSoon ? " task-link-soon" : ""}`}
          >
            <span className="task-icon">
              <Icon size={24} aria-hidden="true" />
            </span>
            <span className="task-copy">
              <strong>{title}</strong>
              {comingSoon && <span className="task-badge">Segera hadir</span>}
              <span className="task-description">{description}</span>
            </span>
          </Link>
        ))}
      </nav>
      <p className="task-office-hours">
        Kantor desa buka [HARI &amp; JAM LAYANAN] · Bantuan: [NOMOR KANTOR]
      </p>
    </div>
  );
}

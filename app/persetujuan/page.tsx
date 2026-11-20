import { PublicShell, PageHeading } from "@/components/site";
import { ApprovalPage } from "@/features/approval/approval-page";

// Token persetujuan ada di URL saat halaman dibuka: jangan diindeks dan jangan dikirim sebagai referrer.
export const metadata = { title: "Persetujuan Surat", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <PublicShell>
      <PageHeading eyebrow="KEPALA DESA" title="Persetujuan surat" intro="Tinjau permohonan, lalu setujui atau tolak dengan PIN persetujuan Anda." />
      <section className="section container service-page status-page">
        <ApprovalPage />
      </section>
    </PublicShell>
  );
}

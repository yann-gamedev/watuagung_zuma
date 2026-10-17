import { Suspense } from "react";
import { PublicShell, PageHeading } from "@/components/site";
import { StatusChecker } from "@/features/pelayanan/status-checker";
export const metadata = { title: "Cek Status Surat" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="PANTAU PELAYANAN"
        title="Cek Status Surat"
        intro="Lihat tahap pengajuan, catatan petugas, dan langkah yang perlu Anda lakukan."
      />
      <section className="section container service-page status-page">
        <Suspense fallback={<div className="skeleton" />}>
          <StatusChecker />
        </Suspense>
      </section>
    </PublicShell>
  );
}

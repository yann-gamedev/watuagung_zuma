import { Suspense } from "react";
import { PublicShell, PageHeading } from "@/components/site";
import { StatusChecker } from "@/features/pelayanan/status-checker";
export const metadata = { title: "Cek Status Permohonan" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="PANTAU PELAYANAN"
        title="Cek Status Permohonan"
        intro="Informasi proses permohonan, dari pengajuan hingga selesai."
      />
      <section className="section container">
        <Suspense fallback={<div className="skeleton" />}>
          <StatusChecker />
        </Suspense>
      </section>
    </PublicShell>
  );
}

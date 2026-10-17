import { Suspense } from "react";
import { PublicShell } from "@/components/site";
import { Success } from "@/features/pelayanan/success";
export const metadata = { title: "Pengajuan Berhasil" };
export default function Page() {
  return (
    <PublicShell>
      <section className="section container service-page status-page">
        <Suspense fallback={<div className="skeleton" />}>
          <Success />
        </Suspense>
      </section>
    </PublicShell>
  );
}

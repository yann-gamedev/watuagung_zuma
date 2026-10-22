import { Suspense } from "react";
import { PublicShell, PageHeading } from "@/components/site";
import { LetterVerifier } from "@/features/pelayanan/letter-verifier";
export const metadata = { title: "Verifikasi Surat" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="CEK KEASLIAN"
        title="Verifikasi Surat"
        intro="Hasil pemindaian QR pada surat keterangan Desa Watuagung."
      />
      <section className="section container service-page status-page">
        <Suspense fallback={<div className="skeleton" />}>
          <LetterVerifier />
        </Suspense>
      </section>
    </PublicShell>
  );
}

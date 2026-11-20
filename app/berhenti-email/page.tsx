import { PublicShell, PageHeading } from "@/components/site";
import { UnsubscribeEmail } from "@/features/pelayanan/unsubscribe-email";

export const metadata = { title: "Berhenti Menerima Email", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <PublicShell>
      <PageHeading eyebrow="PEMBERITAHUAN STATUS" title="Berhenti menerima email" intro="Konfirmasi untuk menghentikan kabar status permohonan melalui email." />
      <section className="section container service-page status-page">
        <UnsubscribeEmail />
      </section>
    </PublicShell>
  );
}

import { PublicShell, PageHeading } from "@/components/site";
import { VerifyNotificationEmail } from "@/features/approval/verify-email";

export const metadata = { title: "Konfirmasi Email Notifikasi", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <PublicShell>
      <PageHeading eyebrow="PANEL PETUGAS" title="Konfirmasi email notifikasi" intro="Konfirmasi alamat email untuk notifikasi akun panel desa." />
      <section className="section container service-page status-page">
        <VerifyNotificationEmail />
      </section>
    </PublicShell>
  );
}

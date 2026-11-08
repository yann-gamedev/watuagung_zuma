import { Store } from "lucide-react";
import { PublicShell, PageHeading } from "@/components/site";
import { PublicBusinesses } from "@/features/umkm/public-businesses";

export const metadata = { title: "UMKM Watuagung", description: "Daftar usaha mikro, kecil, dan menengah warga Desa Watuagung." };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading editorial eyebrow="EKONOMI WARGA" title="UMKM Watuagung" intro="Usaha warga Desa Watuagung yang didata Pemerintah Desa. Pilih kategori untuk menyaring daftar."
        visual={<div className="news-heading-illustration" aria-hidden="true">
          <span className="news-heading-icon"><Store size={54} strokeWidth={1.35} /></span>
          <span className="news-heading-dot" />
        </div>} />
      <PublicBusinesses />
    </PublicShell>
  );
}

import { notFound } from "next/navigation";
import { services } from "@/lib/data";
import { PageHeading, PublicShell } from "@/components/site";
import { ApplicationForm } from "@/features/pelayanan/application-form";
import { HubungiPetugas } from "@/components/hubungi-petugas";
import { ContactAddress, ContactHours } from "@/components/office-contact";
import { pageMeta } from "@/lib/seo";

const descriptions: Record<string, string> = {
  domisili: "Ajukan Surat Keterangan Domisili Desa Watuagung secara online: keterangan tempat tinggal sesuai alamat pemohon. Siapkan Scan KTP, KK, dan pengantar RT/RW.",
  sktm: "Ajukan Surat Keterangan Tidak Mampu Desa Watuagung secara online untuk bantuan pendidikan atau bantuan lain. Siapkan Scan KTP, KK, dan pengantar RT/RW.",
  "belum-menikah": "Ajukan Surat Keterangan Belum Menikah Desa Watuagung secara online: keterangan belum pernah menikah di KUA manapun. Siapkan Scan KTP, KK, dan pengantar RT/RW.",
  keramaian: "Surat Keterangan Izin Keramaian Desa Watuagung untuk izin acara diurus langsung di Balai Desa. Bawa KTP, Kartu Keluarga, dan Surat Pengantar RT/RW asli.",
  kehilangan: "Ajukan Surat Keterangan Kehilangan Desa Watuagung secara online untuk barang atau dokumen yang hilang. Siapkan Scan KTP, Kartu Keluarga, dan pengantar RT/RW.",
  umum: "Ajukan Surat Keterangan Desa Watuagung secara online: keterangan diri pemohon sesuai isi dan tujuan penggunaan. Siapkan Scan KTP, KK, dan pengantar RT/RW.",
};
export function generateStaticParams() {
  return services.map((s) => ({ service: s.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const item = services.find((s) => s.slug === service);
  if (!item) notFound();
  return pageMeta({ title: item.title, description: descriptions[service], path: `/pelayanan/${service}/` });
}
export default async function Page({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const item = services.find((s) => s.slug === service);
  if (!item) notFound();
  if (item.mode === "office") {
    return (
      <PublicShell>
        <PageHeading
          eyebrow="LAYANAN DI KANTOR"
          title={item.title}
          intro={item.description}
          parent={{ label: "Pelayanan Desa", href: "/pelayanan" }}
        />
        <section className="section container service-page service-detail">
          <aside className="service-preparation" aria-labelledby="office-documents-title">
            <h2 id="office-documents-title">Dokumen yang dibawa</h2>
            <p className="service-example">Menunggu konfirmasi desa</p>
            <ul>
              {item.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
            </ul>
            <p className="service-example"><strong>Contoh keperluan:</strong> {item.example}</p>
            <p className="service-example">Daftar dokumen ini belum menjadi ketentuan resmi desa. Tanyakan petugas bila ragu.</p>
            <HubungiPetugas />
          </aside>
          <div className="content-card service-office-card" aria-labelledby="office-service-title">
            <h2 id="office-service-title">Dilayani langsung di Balai Desa</h2>
            <p className="mt-3">Izin Keramaian tidak diajukan melalui website. Silakan datang ke Balai Desa Watuagung dan bawa dokumen di samping.</p>
            <dl className="mt-5">
              <dt><strong>Alamat</strong></dt>
              <dd><ContactAddress /></dd>
              <dt className="mt-3"><strong>Jam pelayanan</strong></dt>
              <dd><ContactHours /></dd>
            </dl>
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell>
      <PageHeading
        eyebrow="PENGAJUAN LAYANAN"
        title={item.title}
        intro={item.description}
        parent={{ label: "Pelayanan Desa", href: "/pelayanan" }}
      />
      <section className="section container service-page service-detail">
        <aside className="service-preparation" aria-labelledby="preparation-title">
          <h2 id="preparation-title">Siapkan dulu</h2>
          <p className="service-example">Persyaratan sementara — menunggu konfirmasi desa</p>
          <ul>
            <li>Scan KTP</li>
            <li>Scan Kartu Keluarga</li>
            <li>Scan Surat Pengantar RT/RW</li>
          </ul>
          <p className="service-estimate"><strong>Waktu pelayanan:</strong> {item.time}</p>
          <p className="service-example"><strong>Contoh keperluan:</strong> {item.example}</p>
          <p className="service-example">Setelah Kepala Desa menyetujui, surat langsung bisa diunduh dan dicetak sendiri melalui Cek Status Surat. Berlaku 7 hari.</p>
          <p className="service-example">Persyaratan ini belum menjadi ketentuan resmi desa.</p>
          <HubungiPetugas />
        </aside>
        <ApplicationForm code={item.code} />
      </section>
    </PublicShell>
  );
}

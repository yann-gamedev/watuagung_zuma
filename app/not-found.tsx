import Link from "next/link";
import { PublicShell } from "@/components/site";
export default function NotFound() {
  return (
    <PublicShell>
      <div className="section container text-center">
        <div className="eyebrow">404 · HALAMAN TIDAK DITEMUKAN</div>
        <h1 className="text-4xl font-bold">Mari kembali ke beranda.</h1>
        <p className="my-6">
          Halaman yang Anda cari tidak tersedia atau alamatnya telah berubah.
        </p>
        <Link href="/" className="btn">
          Kembali ke beranda
        </Link>
      </div>
    </PublicShell>
  );
}

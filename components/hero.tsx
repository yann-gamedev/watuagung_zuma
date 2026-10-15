import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-image" aria-hidden="true" />
      <div className="container hero-content">
        <div className="hero-kicker">PEMERINTAH DESA WATUAGUNG</div>
        <h1 id="hero-title">Urus surat desa tanpa harus antre di balai desa.</h1>
        <p>
          Ajukan surat keterangan dari rumah, pantau prosesnya, lalu ambil di
          kantor desa saat sudah siap.
        </p>
        <div className="hero-actions">
          <Link href="/pelayanan" className="btn btn-gold">
            Ajukan Surat <ArrowRight size={22} aria-hidden="true" />
          </Link>
          <Link href="/pelayanan" className="btn btn-outline">
            Lihat Syarat Surat
          </Link>
        </div>
      </div>
      <div className="hero-caption">
        <MapPin size={14} aria-hidden="true" /> Persawahan di Jawa · foto ilustrasi
      </div>
    </section>
  );
}

import Link from 'next/link';
import {ArrowRight,ShieldCheck,MapPin} from 'lucide-react';
export function Hero(){return (<section className="hero">
        <div className="hero-image" />
        <div className="container hero-content">
          <div className="hero-kicker">
            <span /> SELAMAT DATANG DI DESA WATUAGUNG
          </div>
          <h1>
            Membangun Desa,
            <br />
            Melayani Warga
            <br />
            <em>Lebih Dekat.</em>
          </h1>
          <p>
            Akses informasi desa dan layanan administrasi
            <br className="desktop-break" /> secara mudah, cepat, dan
            transparan.
          </p>
          <div className="hero-actions">
            <Link href="/pelayanan" className="btn btn-gold">
              Ajukan Layanan <ArrowRight size={18} />
            </Link>
            <Link href="/profil" className="btn btn-outline">
              Jelajahi Desa <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-note">
            <ShieldCheck size={18} /> Pelayanan terbuka. Warga berdaya. Desa
            sejahtera.
          </div>
        </div>
        <div className="hero-caption">
          <MapPin size={14} /> Persawahan di Jawa · foto ilustrasi
        </div>
      </section>)}

import Link from "next/link";

const profilePages = [
  ["Profil Desa", "profil"],
  ["Sejarah Desa", "sejarah"],
  ["Visi dan Misi", "visi-misi"],
  ["Struktur Pemerintahan", "struktur-pemerintahan"],
  ["Statistik Desa", "statistik"],
] as const;

export type ProfilePage = (typeof profilePages)[number][1];

/** Pintasan antarhalaman profil desa; halaman yang sedang dibuka tidak ditampilkan. */
export function ProfileLinks({ current, className = "mt-8" }: { current: ProfilePage; className?: string }) {
  return (
    <nav className={`button-row ${className}`} aria-label="Halaman profil desa lainnya">
      {profilePages
        .filter(([, slug]) => slug !== current)
        .map(([title, slug]) => (
          <Link className="btn btn-secondary" href={"/" + slug} key={slug}>
            {title}
          </Link>
        ))}
    </nav>
  );
}

"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink, Menu, X } from "lucide-react";
import { complaintFormUrl, complaintNote, externalLinkProps } from "@/lib/complaint";

/** Pathname tanpa garis miring di akhir (next.config memakai trailingSlash). */
export function normalizePath(path: string | null) {
  return (path ?? "/").replace(/\/+$/, "") || "/";
}

type MenuLink = { label: string; href: string; soon?: boolean; external?: boolean };

const complaintLink: MenuLink = complaintFormUrl
  ? { label: "Sampaikan pengaduan", href: complaintFormUrl, external: true }
  : { label: "Pengaduan", href: "/kontak", soon: true };

const profilPaths = ["/profil", "/sejarah", "/visi-misi", "/struktur-pemerintahan"];

const primaryLinks: { label: string; href: string; isActive: (p: string) => boolean }[] = [
  { label: "Profil Desa", href: "/profil", isActive: (p) => profilPaths.includes(p) },
  {
    label: "Layanan Surat",
    href: "/pelayanan",
    isActive: (p) => p === "/pelayanan" || p.startsWith("/pelayanan/"),
  },
  {
    label: "Berita",
    href: "/berita",
    isActive: (p) => p === "/berita" || p.startsWith("/berita/"),
  },
];

// Hanya route yang sudah ada. Peta Wilayah dan UMKM belum punya halaman.
const menuGroups: { title: string; links: MenuLink[] }[] = [
  {
    title: "Layanan Warga",
    links: [
      { label: "Ajukan Surat", href: "/pelayanan" },
      { label: "Cek Status Surat", href: "/pelayanan/status" },
      complaintLink,
    ],
  },
  {
    title: "Profil Desa",
    links: [
      { label: "Sejarah", href: "/sejarah" },
      { label: "Visi & Misi", href: "/visi-misi" },
      { label: "Perangkat Desa", href: "/struktur-pemerintahan" },
    ],
  },
  {
    title: "Ekonomi & Info",
    links: [
      { label: "BUMDes", href: "/bumdes" },
      { label: "Berita & Agenda", href: "/berita" },
      { label: "Transparansi Anggaran", href: "/transparansi" },
    ],
  },
];

const mobileLinks: MenuLink[] = [
  { label: "Beranda", href: "/" },
  { label: "Cek Status Surat", href: "/pelayanan/status" },
  complaintLink,
  { label: "Profil Desa", href: "/profil" },
  { label: "Perangkat Desa", href: "/struktur-pemerintahan" },
  { label: "BUMDes", href: "/bumdes" },
  { label: "Berita & Agenda", href: "/berita" },
  { label: "Transparansi", href: "/transparansi" },
  { label: "Kontak", href: "/kontak" },
];

function getFocusable(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
  ).filter(
    (el) =>
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  );
}

function SoonBadge() {
  return <span className="menu-soon">Segera hadir</span>;
}

function FormBadge() {
  return <span className="menu-soon" aria-hidden="true">Google Forms</span>;
}

/** Tautan menu: Google Form desa dibuka di tab baru, sisanya route internal. */
function MenuAnchor({
  link,
  className,
  onClick,
  current,
  children,
}: {
  link: MenuLink;
  className?: string;
  onClick: () => void;
  current?: "page";
  children: ReactNode;
}) {
  if (link.external) {
    return (
      <a className={className} href={link.href} onClick={onClick} {...externalLinkProps}>
        {children}
        <span className="sr-only"> ({complaintNote} Dibuka di tab baru.)</span>
      </a>
    );
  }
  return (
    <Link className={className} href={link.href} aria-current={current} onClick={onClick}>
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const path = normalizePath(usePathname());
  const isHome = path === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [prevPath, setPrevPath] = useState(path);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Tutup panel saat berpindah halaman (termasuk tombol kembali browser).
  if (prevPath !== path) {
    setPrevPath(path);
    setOpen(false);
  }

  // Keadaan A hanya di beranda selama scroll < 80px; selain itu keadaan B.
  const variant = isHome && !scrolled ? "top" : "solid";

  const closeMenu = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Deteksi scroll tanpa listener scroll: sentinel di 80px dari atas dokumen.
  // State hanya berubah ketika batas 80px dilewati.
  useEffect(() => {
    if (!isHome) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isHome]);

  // Panel terbuka: kunci scroll, nonaktifkan konten di belakang,
  // pindahkan fokus ke panel, jebak Tab, dan Esc menutup.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const background = Array.from(
      document.querySelectorAll<HTMLElement>("#main, body > footer"),
    );
    background.forEach((el) => (el.inert = true));
    getFocusable(panelRef.current)[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const root = rootRef.current;
      const items = getFocusable(root);
      if (!root || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !root.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      background.forEach((el) => (el.inert = false));
      html.style.overflow = prevOverflow;
    };
  }, [open, closeMenu]);

  const current = (href: string) => (path === href ? "page" : undefined);

  return (
    <>
      <a href="#main" className="skip">
        Lewati ke konten
      </a>
      {isHome && (
        <div ref={sentinelRef} className="site-header-sentinel" aria-hidden="true" />
      )}
      <div
        ref={rootRef}
        className="site-header-root"
        data-variant={variant}
        data-open={open}
      >
        <header className="site-header">
          <div className="container site-header-inner">
            <Link className="site-brand" href="/">
              <Image
                className="site-brand-logo"
                src="/brand/logo-watuagung-128.png"
                alt="Logo Desa Watuagung"
                width={56}
                height={56}
                loading="eager"
              />
              <span className="site-brand-text">
                <strong>WATUAGUNG</strong>
                <small>PEMERINTAH DESA</small>
              </span>
            </Link>
            <nav className="site-nav" aria-label="Navigasi utama">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={link.isActive(path) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="site-header-actions">
              <Link className="site-cta" href="/pelayanan">
                Ajukan Surat
              </Link>
              <button
                ref={toggleRef}
                type="button"
                className="site-menu-btn"
                aria-expanded={open}
                aria-controls="menu-panel"
                onClick={() => (open ? closeMenu() : setOpen(true))}
              >
                {open ? (
                  <X size={22} aria-hidden="true" />
                ) : (
                  <Menu size={22} aria-hidden="true" />
                )}
                <span>{open ? "Tutup" : "Menu"}</span>
              </button>
            </div>
          </div>
        </header>

        <nav
          ref={panelRef}
          id="menu-panel"
          className="menu-panel"
          aria-label="Menu lengkap"
          inert={!open}
        >
          <div className="container menu-panel-inner">
            <div className="menu-desktop">
              {menuGroups.map((group) => (
                <div className="menu-group" key={group.title}>
                  <h2 className="menu-label">{group.title}</h2>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <MenuAnchor
                          link={link}
                          current={link.soon ? undefined : current(link.href)}
                          onClick={closeMenu}
                        >
                          {link.label}
                          {link.soon && <SoonBadge />}
                          {link.external && <FormBadge />}
                        </MenuAnchor>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="menu-contact">
                <h2 className="menu-label">Kontak Kantor</h2>
                <p>[ALAMAT KANTOR DESA]</p>
                <p>Buka [HARI &amp; JAM LAYANAN]</p>
                <Link className="menu-contact-btn" href="/kontak" onClick={closeMenu}>
                  Lihat Kontak Kantor
                </Link>
              </div>
            </div>

            <div className="menu-mobile">
              <Link className="menu-mobile-cta" href="/pelayanan" onClick={closeMenu}>
                Ajukan Surat
              </Link>
              <ul className="menu-mobile-list">
                {mobileLinks.map((link) => (
                  <li key={link.label}>
                    <MenuAnchor
                      link={link}
                      current={link.soon ? undefined : current(link.href)}
                      onClick={closeMenu}
                    >
                      <span className="menu-mobile-text">
                        {link.label}
                        {link.soon && <SoonBadge />}
                        {link.external && <FormBadge />}
                      </span>
                      {link.external ? (
                        <ExternalLink size={22} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={22} aria-hidden="true" />
                      )}
                    </MenuAnchor>
                  </li>
                ))}
              </ul>
              <div className="menu-contact">
                <h2 className="menu-label">Kantor Desa</h2>
                <p>[ALAMAT KANTOR DESA] · Buka [HARI &amp; JAM LAYANAN]</p>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}

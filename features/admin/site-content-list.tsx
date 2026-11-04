"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStaffSiteSection } from "@/services/site";
import type { EditableSiteSectionKey } from "@/types/site";
import { AdminSiteNotFoundError, AdminUnauthorizedError } from "./api";
import { formatUpdatedAt } from "./site-form";
import { useAdminSession } from "./session";
import styles from "./applications.module.css";

export const sitePages: { key: EditableSiteSectionKey; title: string; description: string; href: string }[] = [
  { key: "profile", title: "Profil desa", description: "Ringkasan, angka utama, batas wilayah, lembaga desa.", href: "/admin/konten/profil" },
  { key: "history", title: "Sejarah desa", description: "Asal-usul, dusun, kepala desa dari masa ke masa.", href: "/admin/konten/sejarah" },
  { key: "contact", title: "Kontak kantor", description: "Alamat, jam pelayanan, nomor, peta. Tampil di beranda, /kontak, menu, dan footer.", href: "/admin/konten/kontak" },
];

type State = Record<EditableSiteSectionKey, string | null | "error" | undefined>;

export function SiteContentList() {
  const { request, user } = useAdminSession();
  const allowed = !!user && ["admin", "staff"].includes(user.role);
  const [state, setState] = useState<Partial<State>>({});

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    for (const { key } of sitePages) {
      getStaffSiteSection(request, key).then((result) => result.updated_at, (cause: unknown) => {
        if (cause instanceof AdminUnauthorizedError) return undefined;
        return cause instanceof AdminSiteNotFoundError ? null : "error";
      }).then((value) => { if (!cancelled) setState((old) => ({ ...old, [key]: value })); });
    }
    return () => { cancelled = true; };
  }, [allowed, request]);

  if (!allowed) return <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>;
  return <div className={styles.list}>
    <div className={styles.intro}><p>Pilih halaman website yang ingin diubah. Perubahan langsung tampil di website setelah disimpan.</p></div>
    <ul className={`${styles.summaryCards} ${styles.contentCards}`} aria-label="Halaman yang bisa diubah">
      {sitePages.map(({ key, title, description, href }) => {
        const value = state[key];
        return <li key={key}>
          <Link href={href} className={styles.summaryCard} prefetch={false}>
            <strong>{title}</strong>
            <span>{description}</span>
            <span>{!(key in state) ? "Memeriksa perubahan terakhir…"
              : value === "error" ? "Tanggal perubahan belum dapat dimuat."
              : value ? <>Terakhir diubah <time dateTime={value}>{formatUpdatedAt(value)}</time></>
              : "Belum pernah diubah — website memakai isi bawaan"}</span>
          </Link>
        </li>;
      })}
    </ul>
  </div>;
}

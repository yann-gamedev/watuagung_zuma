"use client";
import { useEffect } from "react";
import Link from "next/link";
import { isDemo } from "@/services/pelayanan";

export function LegacyNewsRedirect({ slug }: { slug?: string }) {
  useEffect(() => {
    if (isDemo) return;
    const match = window.location.pathname.match(/^\/berita\/([^/]+)\/?$/);
    const oldSlug = slug ?? (match && !["baca", "belum-ada"].includes(match[1]) ? match[1] : null);
    // Path lama bisa berisi persen rusak; jangan sampai halaman 404 ikut gagal.
    let decoded = oldSlug;
    try { if (oldSlug && !slug) decoded = decodeURIComponent(oldSlug); } catch { return; }
    if (decoded) window.location.replace(`/berita/baca/?slug=${encodeURIComponent(decoded)}`);
  }, [slug]);
  return slug ? <p role="status">Membuka berita… <Link href={`/berita/baca/?slug=${encodeURIComponent(slug)}`}>Baca berita</Link></p> : null;
}

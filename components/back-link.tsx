"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * Riwayat kunjungan di situs ini selama satu tab (sessionStorage).
 * Dipakai hanya untuk memutuskan apakah "Kembali" aman memakai history browser,
 * sehingga pengguna yang datang dari luar situs tidak terlempar keluar.
 */
const STORAGE_KEY = "watuagung:nav-stack";
const MAX_ENTRIES = 50;

function readStack(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_ENTRIES)));
  } catch {
    // Penyimpanan tidak tersedia: tombol Kembali memakai tautan cadangan.
  }
}

function currentLocation() {
  return window.location.pathname + window.location.search;
}

/** Dipasang sekali di PublicShell; mencatat setiap perpindahan halaman. */
export function NavHistoryTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const here = currentLocation();
    const stack = readStack();
    if (stack[stack.length - 1] === here) return; // muat ulang halaman yang sama
    if (stack[stack.length - 2] === here) stack.pop(); // pengguna kembali
    else stack.push(here);
    writeStack(stack);
  }, [pathname]);
  return null;
}

/**
 * Tombol "Kembali" ke halaman asal. Tanpa riwayat di situs ini (dibuka dari
 * tautan luar atau tab baru), tombol menjadi tautan biasa ke `fallbackHref`.
 */
export function BackLink({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // Tunggu NavHistoryTracker mencatat halaman ini lebih dulu.
    const id = window.setTimeout(() => setCanGoBack(readStack().length > 1), 0);
    return () => window.clearTimeout(id);
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!canGoBack || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    router.back();
  }

  return (
    <Link className="back-link" href={fallbackHref} onClick={handleClick}>
      <ArrowLeft size={20} aria-hidden="true" />
      Kembali
    </Link>
  );
}

"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAdminSession } from "./session";

/** Sambutan sementara. Ringkasan angka per status dikerjakan di sesi A4. */
export function AdminDashboard() {
  const { user } = useAdminSession();
  const queue = user?.role === "rt_head" ? "rt" : user?.role === "rw_head" ? "rw" : null;
  return (
    <section className="admin-card admin-welcome">
      <h2>Selamat datang, {user?.name}</h2>
      <p>Gunakan panel ini untuk memeriksa permohonan surat warga dan memperbarui statusnya. Data pribadi sensitif pemohon tidak ditampilkan di daftar.</p>
      <Link href={queue ? `/admin/antrean-${queue}` : "/admin/permohonan"} className="btn">{queue ? `Buka Antrean ${queue.toUpperCase()}` : "Buka daftar permohonan"} <ArrowRight size={22} aria-hidden="true" /></Link>
    </section>
  );
}

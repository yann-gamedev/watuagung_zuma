"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAdminSession } from "./session";

/** Sambutan sementara. Ringkasan angka per status dikerjakan di sesi A4. */
export function AdminDashboard() {
  const { user } = useAdminSession();
  return (
    <section className="admin-card admin-welcome">
      <h2>Selamat datang, {user?.name}</h2>
      <p>Gunakan panel ini untuk memeriksa permohonan surat warga dan memperbarui statusnya. Data pribadi sensitif pemohon tidak ditampilkan di daftar.</p>
      <Link href="/admin/permohonan" className="btn">Buka daftar permohonan <ArrowRight size={22} aria-hidden="true" /></Link>
    </section>
  );
}

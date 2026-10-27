"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { z } from "zod";
import { StatusBadge } from "@/components/site";
import { statuses, type StaffSummary } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import { applicationServiceLabels, buildApplicationDetailHref, buildApplicationsHref, parseApplicationFilters } from "./application-filters";
import styles from "./applications.module.css";

const count = z.number().int().nonnegative();
const summarySchema = z.object({
  by_status: z.object(Object.fromEntries(statuses.map((status) => [status, count])) as Record<typeof statuses[number], typeof count>),
  my_queue: count,
  today: count,
  oldest: z.array(z.object({
    request_id: z.string().regex(/^REQ-\d{4}-[A-Z0-9]+$/).max(64),
    nama: z.string(), jenis_surat: z.enum(["SKU", "DOMISILI", "SKTM", "KTP_KK"]),
    status: z.enum(statuses), created_at: z.string().datetime(), allowed_transitions: z.array(z.enum(statuses)),
  })).max(5),
});

export function AdminDashboard() {
  const { user, request } = useAdminSession();
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const section = user?.role === "rt_head" ? "antrean-rt" : user?.role === "rw_head" ? "antrean-rw" : "permohonan";
  const filters = (query: string) => parseApplicationFilters(new URLSearchParams(`view=all&${query}`), section);

  useEffect(() => {
    let cancelled = false;
    void request<unknown>("/staff/summary").then((result) => {
      const parsed = summarySchema.safeParse(result);
      if (!parsed.success) throw new Error("Ringkasan dari server tidak valid. Silakan coba lagi.");
      if (!cancelled) setSummary(parsed.data);
    }).catch((cause: unknown) => {
      if (cancelled || cause instanceof AdminUnauthorizedError) return;
      setError(cause instanceof Error ? cause.message : "Gagal mengambil ringkasan permohonan.");
    });
    return () => { cancelled = true; };
  }, [request, attempt]);

  const cards = summary ? [
    { label: "Perlu tindakan Anda", value: summary.my_queue, query: "my_queue=1" },
    { label: "Masuk hari ini", value: summary.today, query: "today=1" },
    { label: "Menunggu persetujuan Kepala Desa", value: summary.by_status.WAITING_APPROVAL, query: "status=WAITING_APPROVAL" },
    { label: "Siap diambil", value: summary.by_status.READY_FOR_PICKUP, query: "status=READY_FOR_PICKUP" },
  ] : [];

  return <div className={styles.list}>
    <div className={styles.intro}>
      <p>Ringkasan permohonan yang dapat Anda akses. Buka kartu untuk melihat daftarnya.</p>
      <button type="button" className="btn btn-secondary" onClick={() => { setSummary(null); setError(""); setAttempt((value) => value + 1); }}>
        <RefreshCw size={22} aria-hidden="true" /> Muat ulang
      </button>
    </div>
    {error ? <p className={styles.error} role="alert">{error} Gunakan tombol Muat ulang untuk mencoba lagi.</p>
      : !summary ? <p className={styles.message} role="status">Memuat ringkasan permohonan…</p> : <>
        <div className={styles.summaryCards} aria-label="Ringkasan permohonan">
          {cards.map((card) => <Link key={card.query} href={buildApplicationsHref(section, filters(card.query))} className={styles.summaryCard} prefetch={false}>
            <span>{card.label}</span><strong>{card.value}</strong>
          </Link>)}
        </div>
        <section className={styles.panel} aria-labelledby="oldest-title">
          <h2 id="oldest-title">Antrean terlama</h2>
          {summary.oldest.length === 0 ? <p className={styles.message}>Belum ada permohonan yang perlu ditangani.</p> : <ul className={styles.oldest}>
            {summary.oldest.map((record) => <li key={record.request_id}>
              <Link className={styles.card} href={buildApplicationDetailHref(record.request_id, section, filters("my_queue=1&sort=terlama"))} prefetch={false}>
                <span className={styles.cardNumber}>{record.request_id}</span>
                <span>{record.nama} · {applicationServiceLabels[record.jenis_surat]}</span>
                <time dateTime={record.created_at}>{new Date(record.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</time>
                <StatusBadge status={record.status} jenisSurat={record.jenis_surat} />
                <span className={styles.cardAction}>Buka detail permohonan</span>
              </Link>
            </li>)}
          </ul>}
        </section>
      </>}
  </div>;
}

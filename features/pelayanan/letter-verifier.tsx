"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { z } from "zod";
import { apiRequest, isDemo } from "@/services/pelayanan";
import { services } from "@/lib/data";
import { serviceCodes } from "@/types/pelayanan";
import type { LetterVerification } from "@/types/pelayanan";

const schema = z.object({
  number: z.string().nullable(), jenis_surat: z.enum(serviceCodes),
  issued_at: z.string(), nama: z.string(), valid_until: z.string().nullable(), status: z.enum(["valid", "expired", "revoked"]),
});

/** Warna memakai kelas status yang ada: hijau (siap diunduh), kuning (perlu perbaikan), merah (ditolak). */
const verdictClass = { valid: "READY_FOR_PICKUP", expired: "NEED_REVISION", revoked: "REJECTED" } as const;
const verdictLabel = { valid: "SAH", expired: "KEDALUWARSA", revoked: "DIBATALKAN" } as const;
const dateTime = (value: string) => new Date(value).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB";

/** Membaca ?kode= di browser (static export); kode tidak dikirim ke tempat lain selain API verifikasi. */
export function LetterVerifier() {
  const code = useSearchParams().get("kode") ?? "";
  const valid = /^[A-Za-z0-9]{32}$/.test(code);
  const [result, setResult] = useState<LetterVerification | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(valid && !isDemo);
  useEffect(() => {
    if (!valid || isDemo) return;
    let cancelled = false;
    apiRequest<unknown>(`/verify/${code}`)
      .then((body) => { if (!cancelled) setResult(schema.parse(body)); })
      .catch(() => { if (!cancelled) setError("Surat tidak ditemukan. Pastikan QR dipindai dari surat asli, atau hubungi kantor desa."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code, valid]);

  return (
    <div className="center-card status-card">
      {isDemo ? <div className="notice"><strong>Tidak tersedia pada demo.</strong><p>Verifikasi surat hanya berjalan pada layanan resmi desa.</p></div>
        : !valid ? <div className="error-box" role="alert"><CircleAlert size={24} aria-hidden="true" /><span>Kode verifikasi tidak ada atau tidak lengkap. Pindai ulang QR pada surat.</span></div>
        : loading ? <div className="skeleton" role="status" aria-label="Memeriksa surat" />
        : error ? <div className="error-box" role="alert"><CircleAlert size={24} aria-hidden="true" /><span>{error}</span></div>
        : result && <section className="lookup-result" aria-labelledby="verify-heading">
          <div className={"status-exception status-" + verdictClass[result.status]} role="status">
            <div className="status-exception-heading">
              {result.status === "valid" ? <CircleCheck size={24} aria-hidden="true" /> : result.status === "expired" ? <CircleAlert size={24} aria-hidden="true" /> : <CircleX size={24} aria-hidden="true" />}
              <h2 id="verify-heading">{verdictLabel[result.status]}</h2>
            </div>
            <p>{result.status === "valid"
              ? (result.valid_until ? <>Berlaku sampai <strong><time dateTime={result.valid_until}>{dateTime(result.valid_until)}</time></strong>.</> : "Surat tercatat di Desa Watuagung.")
              : result.status === "expired"
                ? (result.valid_until ? <>Kedaluwarsa sejak <strong><time dateTime={result.valid_until}>{dateTime(result.valid_until)}</time></strong>. Surat ini tidak berlaku lagi.</> : "Surat ini tidak berlaku lagi.")
                : "Surat ini dibatalkan oleh Pemerintah Desa Watuagung dan tidak berlaku."}</p>
          </div>
          <dl className="status-next-step">
            <dt>Nomor surat</dt><dd className="receipt-value">{result.number ?? "Tidak bernomor (permohonan lama)"}</dd>
            <dt>Jenis surat</dt><dd>{services.find((s) => s.code === result.jenis_surat)?.title ?? result.jenis_surat}</dd>
            <dt>Nama lengkap</dt><dd>{result.nama}</dd>
            <dt>Tanggal rilis</dt><dd><time dateTime={result.issued_at}>{dateTime(result.issued_at)}</time></dd>
          </dl>
          <p className="mt-4"><strong>Cocokkan nama dan nomor dengan surat yang Anda terima.</strong> Bila berbeda, surat tersebut tidak sah. QR ini alat cek keaslian dari website resmi desa, bukan tanda tangan elektronik tersertifikasi.</p>
          <Link href="/kontak" className="text-link">Lihat Kontak Kantor</Link>
        </section>}
    </div>
  );
}

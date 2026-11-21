import type { Status } from "@/types/pelayanan";

/**
 * Tampilan saja; kebutuhan RT/RW berasal dari respons LetterType backend, bukan tabel jenis surat frontend.
 * Persetujuan Kepala Desa langsung merilis surat (V2), jadi APPROVED dan READY_FOR_PICKUP satu tahap di linimasa
 * warga. Status APPROVED hanya ada pada data lama; `timelineStatus` memetakannya ke tahap gabungan ini.
 */
export function letterSteps(neighborhoodApproval = false): ReadonlyArray<readonly [Status, string, string]> {
  return [
    ["SUBMITTED", "Diterima", "Penerimaan data pengajuan."],
    ...(neighborhoodApproval ? [
      ["RT_APPROVED", "Disetujui RT", "Persetujuan Ketua RT wilayah pemohon."],
      ["RW_APPROVED", "Disetujui RW", "Persetujuan Ketua RW sebelum masuk kantor desa."],
    ] as const : []),
    ["VERIFIED", "Diverifikasi desa", "Verifikasi kelengkapan data oleh petugas desa."],
    ["PROCESSING", "Diproses", "Penyiapan surat oleh petugas."],
    ["WAITING_APPROVAL", "Menunggu persetujuan Kepala Desa", "Pengajuan menunggu persetujuan Kepala Desa."],
    ["READY_FOR_PICKUP", "Disetujui, siap diunduh", "Surat sudah bisa diunduh dan dicetak. Berlaku sampai {tanggal}."],
    ["COMPLETED", "Selesai", "Surat sudah diunduh."],
  ];
}

/** Status yang dipakai untuk menandai tahap linimasa warga. */
export function timelineStatus(status: Status): Status {
  return status === "APPROVED" ? "READY_FOR_PICKUP" : status;
}

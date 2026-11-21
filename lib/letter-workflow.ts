import type { Status } from "@/types/pelayanan";

/**
 * Tampilan saja; kebutuhan RT/RW berasal dari respons LetterType backend, bukan tabel jenis surat frontend.
 * Persetujuan Kepala Desa langsung merilis surat (V2), jadi bagi warga alur selesai saat Kepala Desa menyetujui:
 * tahap terakhir adalah "Selesai — disetujui Kepala Desa". APPROVED (data lama), READY_FOR_PICKUP, dan COMPLETED
 * (sudah diunduh/masa unduh habis) dipetakan ke tahap itu oleh `timelineStatus`. Status server tidak berubah.
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
    ["READY_FOR_PICKUP", "Selesai — disetujui Kepala Desa", "Surat sudah bisa diunduh dan dicetak. Berlaku sampai {tanggal}."],
  ];
}

/** Status yang dipakai untuk menandai tahap linimasa warga. */
export function timelineStatus(status: Status): Status {
  return isCitizenFinal(status) ? "READY_FOR_PICKUP" : status;
}

/** Disetujui (data lama), siap diunduh, dan sudah diunduh: bagi warga semuanya "Selesai". Panel tetap memakai label server. */
export function isCitizenFinal(status: Status): boolean {
  return status === "APPROVED" || status === "READY_FOR_PICKUP" || status === "COMPLETED";
}

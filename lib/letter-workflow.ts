import type { Status } from "@/types/pelayanan";

/** Tampilan saja; kebutuhan RT/RW berasal dari respons LetterType backend, bukan tabel jenis surat frontend. */
export function letterSteps(neighborhoodApproval = false): ReadonlyArray<readonly [Status, string, string]> {
  return [
    ["SUBMITTED", "Diterima", "Penerimaan data pengajuan."],
    ...(neighborhoodApproval ? [
      ["RT_APPROVED", "Disetujui RT", "Persetujuan Ketua RT wilayah pemohon."],
      ["RW_APPROVED", "Disetujui RW", "Persetujuan Ketua RW sebelum masuk kantor desa."],
    ] as const : []),
    ["VERIFIED", "Diverifikasi desa", "Verifikasi kelengkapan data oleh petugas desa."],
    ["PROCESSING", "Diproses", "Penyiapan surat oleh petugas."],
    ["WAITING_APPROVAL", "Menunggu tanda tangan Kepala Desa", "Pengajuan menunggu persetujuan Kepala Desa; tanda tangan elektronik belum tersedia."],
    ["APPROVED", "Disetujui", "Persetujuan pengajuan surat."],
    ["READY_FOR_PICKUP", "Siap diambil", "Surat siap diambil di kantor desa."],
    ["COMPLETED", "Selesai", "Surat sudah diambil."],
  ];
}

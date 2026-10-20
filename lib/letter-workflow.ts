import type { ServiceCode, Status } from "@/types/pelayanan";

/** Mencerminkan backend/app/Domain/LetterType.php; bukan aturan otorisasi. */
export const letterTypes: Record<ServiceCode, { requiresNeighborhoodApproval: boolean }> = {
  SKU: { requiresNeighborhoodApproval: false },
  DOMISILI: { requiresNeighborhoodApproval: true },
  SKTM: { requiresNeighborhoodApproval: true },
  KTP_KK: { requiresNeighborhoodApproval: true },
};
export function requiresNeighborhoodApproval(type?: ServiceCode) {
  return type ? letterTypes[type].requiresNeighborhoodApproval : false;
}
const officeSteps: ReadonlyArray<readonly [Status, string, string]> = [
  ["VERIFIED", "Diverifikasi desa", "Verifikasi kelengkapan data oleh petugas desa."],
  ["PROCESSING", "Diproses", "Penyiapan surat oleh petugas."],
  ["WAITING_APPROVAL", "Menunggu tanda tangan Kepala Desa", "Pengajuan menunggu persetujuan Kepala Desa; tanda tangan elektronik belum tersedia."],
  ["APPROVED", "Disetujui", "Persetujuan pengajuan surat."],
  ["READY_FOR_PICKUP", "Siap diambil", "Surat siap diambil di kantor desa."],
  ["COMPLETED", "Selesai", "Surat sudah diambil."],
];
export function letterSteps(type: ServiceCode): ReadonlyArray<readonly [Status, string, string]> {
  return [
    ["SUBMITTED", "Diterima", "Penerimaan data pengajuan."],
    ...(requiresNeighborhoodApproval(type) ? [
      ["RT_APPROVED", "Disetujui RT", "Persetujuan Ketua RT wilayah pemohon."],
      ["RW_APPROVED", "Disetujui RW", "Persetujuan Ketua RW sebelum masuk kantor desa."],
    ] as const : []),
    ...officeSteps,
  ];
}

export const statuses = [
  "SUBMITTED",
  "VERIFIED",
  "PROCESSING",
  "WAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "NEED_REVISION",
] as const;
export type Status = (typeof statuses)[number];
export type ServiceCode = "SKU" | "DOMISILI" | "SKTM" | "KTP_KK";
export interface Submission {
  jenis_surat: ServiceCode;
  nama: string;
  nik: string;
  no_kk: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  alamat: string;
  rt: string;
  rw: string;
  telepon: string;
  nama_usaha?: string;
  jenis_usaha?: string;
  alamat_usaha?: string;
  keperluan: string;
}
export interface Receipt {
  success: true;
  request_id: string;
  status: Status;
  lookup_secret?: string;
}
export interface RequestRecord extends Receipt {
  nama: string;
  jenis_surat: ServiceCode;
  tanggal: string;
  catatan?: string;
}

// Deliberately invalid regional prefix: these are fictional test identities, not resident records.
export const dummyResidents = [
  { nik: "0000000000000001", nama: "Pemohon Contoh Satu", tempat_lahir: "Kota Contoh A", tanggal_lahir: "2000-03-14" },
  { nik: "0000000000000002", nama: "Pemohon Contoh Dua", tempat_lahir: "Kota Contoh B", tanggal_lahir: "1995-08-21" },
  { nik: "0000000000000003", nama: "Pemohon Contoh Tiga", tempat_lahir: "Kota Contoh C", tanggal_lahir: "2002-12-05" },
] as const;

export function findDummyResident(nik: string) {
  return /^\d{16}$/.test(nik) ? dummyResidents.find((resident) => resident.nik === nik) : undefined;
}

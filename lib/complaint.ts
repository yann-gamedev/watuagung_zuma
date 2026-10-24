// Pengaduan tidak dibangun di website (keputusan 24 Okt 2026); warga diarahkan ke Google Form desa.
const allowedPrefixes = ["https://forms.gle/", "https://docs.google.com/forms/"];

/** URL hanya diterima bila mengarah ke Google Forms; selain itu dianggap kosong. */
export function parseComplaintFormUrl(value: string | undefined) {
  const url = value?.trim() ?? "";
  return allowedPrefixes.some((prefix) => url.startsWith(prefix) && url.length > prefix.length)
    ? url
    : "";
}

// Literal process.env.* agar Next.js menyisipkan nilainya saat build.
export const complaintFormUrl = parseComplaintFormUrl(process.env.NEXT_PUBLIC_COMPLAINT_FORM_URL);
export const complaintNote = "Formulir dikelola Pemerintah Desa Watuagung melalui Google Forms.";
export const externalLinkProps = { target: "_blank", rel: "noopener noreferrer" } as const;

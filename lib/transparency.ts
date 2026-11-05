import type { SiteBudget } from "@/types/site";

/** Lima bidang belanja APBDes; sama persis (label dan urutan) dengan SiteSectionRules::SPENDING_FIELDS. */
export const SPENDING_FIELDS = [
  "Penyelenggaraan Pemerintahan Desa",
  "Pelaksanaan Pembangunan",
  "Pembinaan Kemasyarakatan",
  "Pemberdayaan Masyarakat",
  "Penanggulangan Bencana, Keadaan Darurat, dan Mendesak",
] as const;

const sum = (lines: { amount: number }[] = []) => lines.reduce((total, line) => total + line.amount, 0);

/** Satu-satunya sumber total untuk panel dan publik; server tidak menyimpan total. */
export function budgetTotals(budget: Pick<SiteBudget, "revenue" | "spending" | "financing">) {
  const revenue = sum(budget.revenue);
  const spending = sum(budget.spending);
  // ponytail: pembiayaan ditampilkan terpisah tanpa tanda penerimaan/pengeluaran; pisahkan bila APBDes resmi memerlukan pembiayaan netto.
  return { revenue, spending, financing: sum(budget.financing), surplus: revenue - spending };
}

/** "Rp1.234.567". Tanpa Intl agar server dan browser selalu sama. */
export function formatRupiah(amount: number) {
  return `${amount < 0 ? "-" : ""}Rp${String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

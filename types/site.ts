// Teks biasa: render lewat React, jangan dangerouslySetInnerHTML.
export type SiteSectionKey = "profile" | "contact" | "history" | "statistics" | "transparency" | "structure" | "videos";
export type SiteTextSection = {
  intro: string;
  blocks: { title: string; text: string }[];
};
export type SiteContact = {
  address: string;
  hours: string;
  contactName: string;
  phone: string;
  mapsEmbedUrl: string;
  mapsLinkUrl: string;
};
export type SiteProfileDetails = {
  themes: string[];
  stats: { value: string; label: string; detail?: string }[];
  location: string;
  boundaries: { direction: string; place: string }[];
  institutions: { name: string; description: string }[];
  source: string;
};
export type SiteProfile = SiteTextSection & { profileDetails?: SiteProfileDetails };
/** Rupiah bulat. Total tidak disimpan; hitung dengan budgetTotals() di lib/transparency.ts. */
export type SiteBudgetLine = { label: string; amount: number };
export type SiteBudget = {
  year: number;
  status: "Rancangan" | "Ditetapkan" | "Perubahan";
  revenue: SiteBudgetLine[];
  /** Tepat 5 bidang, label dan urutan = SPENDING_FIELDS. */
  spending: SiteBudgetLine[];
  financing?: SiteBudgetLine[];
  source: string;
  /** Dari POST /staff/site/transparency/document; URL publik ada di document_urls. */
  documentPath?: string;
};
export type SiteTransparency = { intro: string; programs: { title: string; text: string }[]; budgets: SiteBudget[] };
export type SiteStructure = { chartImagePath?: string; chartAlt?: string; blocks: SiteTextSection["blocks"]; source: string };
/** Tersimpan dan dikirim server: ID 11 karakter saja, bukan URL. */
export type SiteVideo = { youtubeId: string; title: string };
export type SiteVideos = { profile: SiteVideo | null; tutorial: SiteVideo | null };
/** Body PUT videos: panel mengirim link YouTube; server mengekstrak ID (link lain 422 errors.data.<slot>.url). */
export type SiteVideoInput = { url: string; title: string };
export type SiteVideosInput = { profile: SiteVideoInput | null; tutorial: SiteVideoInput | null };
export type SiteSectionData = {
  profile: SiteProfile;
  contact: SiteContact;
  history: SiteTextSection;
  statistics: never;
  transparency: SiteTransparency;
  structure: SiteStructure;
  videos: SiteVideos;
};
/** Bentuk body PUT; sama dengan SiteSectionData kecuali videos. */
export type SiteSectionInput = Omit<SiteSectionData, "videos"> & { videos: SiteVideosInput };
export type EditableSiteSectionKey = "profile" | "contact" | "history" | "transparency" | "structure" | "videos";
export type SiteSectionResponse<K extends SiteSectionKey = EditableSiteSectionKey> = {
  [P in K]: { key: P; data: SiteSectionData[P]; updated_at: string } & (P extends "transparency" ? { document_urls: Record<string, string> } : P extends "structure" ? { image_url: string | null } : unknown);
}[K];
export type SiteSectionUpdate<K extends EditableSiteSectionKey> = { data: SiteSectionInput[K] };
/** Hanya structure: JPG/PNG/WebP ≤ 5 MB. PUT chartImagePath menerbitkan gambar. */
export type SiteSectionImageResponse = { path: string; url: string };
/** Hanya transparency: PDF ≤ 10 MB. Simpan `path` ke budgets[].documentPath lalu PUT. */
export type SiteSectionDocumentResponse = { path: string; url: string };

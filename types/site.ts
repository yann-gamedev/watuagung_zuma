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
export type SiteSectionData = {
  profile: SiteProfile;
  contact: SiteContact;
  history: SiteTextSection;
  statistics: never;
  transparency: never;
  structure: never;
  videos: never;
};
export type EditableSiteSectionKey = "profile" | "contact" | "history";
export type SiteSectionResponse<K extends SiteSectionKey = EditableSiteSectionKey> = {
  [P in K]: { key: P; data: SiteSectionData[P]; updated_at: string };
}[K];
export type SiteSectionUpdate<K extends EditableSiteSectionKey> = { data: SiteSectionData[K] };
// Scaffold saja: belum ada key yang mengizinkan upload; seluruh permintaan terotorisasi mendapat 422.
export type SiteSectionImageResponse = { path: string };

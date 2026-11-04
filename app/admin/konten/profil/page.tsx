import { SiteEditor } from "@/features/admin/site-editor";

export const metadata = { title: "Konten profil desa" };
export default function Page() {
  return <SiteEditor section="profile" />;
}

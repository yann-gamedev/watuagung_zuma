import { SiteEditor } from "@/features/admin/site-editor";

export const metadata = { title: "Konten sejarah desa" };
export default function Page() {
  return <SiteEditor section="history" />;
}

import { AdminSidebar } from "@/components/admin-sidebar";
import { apiBase } from "@/services/pelayanan";
export const metadata = {
  title: "Panel Petugas Desa",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">Lewati ke konten</a>
      {/* Navigasi petugas hanya tampil bila API aktif; demo tidak boleh terlihat operasional. */}
      <div className="admin-layout">{apiBase && <AdminSidebar />}<main id="main" className="admin-main">{children}</main></div>
    </>
  );
}

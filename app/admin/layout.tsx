import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <AdminShell adminMobile={user.mobile} adminName={user.name}>
      {children}
    </AdminShell>
  );
}

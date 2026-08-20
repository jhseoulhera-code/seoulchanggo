import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminForbiddenScreen, AdminNotConfiguredScreen } from "@/components/admin/AdminBlockerScreen";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await checkAdminAccess();

  if (access.status === "not_configured") {
    return <AdminNotConfiguredScreen />;
  }
  if (access.status === "unauthenticated") {
    redirect("/auth?returnTo=/admin");
  }
  if (access.status === "forbidden") {
    return <AdminForbiddenScreen />;
  }

  return <AdminShell adminName={access.profile.display_name}>{children}</AdminShell>;
}

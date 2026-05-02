import { requireServerAuth } from "@/lib/server-auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth();
  return <>{children}</>;
}

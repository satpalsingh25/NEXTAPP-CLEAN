import { requireServerAuth } from "@/lib/server-auth";

export default async function ComplianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth();
  return <>{children}</>;
}

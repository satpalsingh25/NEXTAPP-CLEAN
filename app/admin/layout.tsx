import { requireServerAuth } from "@/lib/server-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth();
  return <div className="p-6">{children}</div>;
}

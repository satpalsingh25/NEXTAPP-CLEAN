import { requireServerAuth } from "@/lib/server-auth";

export default async function AmcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAuth();
  return <>{children}</>;
}

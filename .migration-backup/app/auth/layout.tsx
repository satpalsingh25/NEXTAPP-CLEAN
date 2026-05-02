import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      redirect("/dashboard");
    } catch {
      // token invalid — show login page
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}

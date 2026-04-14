import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export async function requireServerAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/auth/login");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      user_id: string;
      company_id: string;
      role: string;
      email: string;
    };
    return decoded;
  } catch {
    redirect("/auth/login");
  }
}

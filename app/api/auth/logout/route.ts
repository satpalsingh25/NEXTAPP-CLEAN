import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  const isSecure =
    req.headers.get("x-forwarded-proto") === "https" ||
    !!process.env.REPLIT_DOMAINS ||
    process.env.NODE_ENV === "production";
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

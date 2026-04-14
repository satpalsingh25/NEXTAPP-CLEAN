import { AuthProvider } from "@/context/AuthContext";
import ClientLayout from "@/components/ClientLayout";
import "./globals.css";

export const metadata = {
  title: "Compliance & AMC Management",
  description: "Multi-tenant Compliance and AMC management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 antialiased text-slate-900">
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

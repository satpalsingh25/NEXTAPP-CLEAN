import { AuthProvider } from "@/context/AuthContext";
import { BrandingProvider } from "@/context/BrandingContext";
import ClientLayout from "@/components/ClientLayout";
import "./globals.css";

export const metadata = {
  title: "Compliance & AMC Management",
  description: "Multi-tenant Compliance and AMC management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <BrandingProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </BrandingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

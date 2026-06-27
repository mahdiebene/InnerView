import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { PollinationsProvider } from "@/components/PollinationsProvider";

export const metadata: Metadata = {
  title: "InnerView — your searchable emotional memory",
  description:
    "A private journal where every entry becomes mood-art, a spoken reflection, and a searchable feeling. End-to-end encrypted. Powered by Pollinations AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="paper-grain min-h-screen font-sans text-ink-900 antialiased">
        <AuthProvider>
          <PollinationsProvider>{children}</PollinationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

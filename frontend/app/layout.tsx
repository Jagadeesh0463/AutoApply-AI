import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "AutoApply AI",
  description: "Intelligent cold email job applier with ATS resume tailoring",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <ToastProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-8 animate-fade-up">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}

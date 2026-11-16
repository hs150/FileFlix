import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FileFix — Fast, Private, Free File Utility",
  description: "Fix, convert, compress, and organize everyday files directly in your browser. 100% private, zero server uploads for core tools.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-blue-600">
              <span className="bg-blue-600 text-white rounded-lg p-1.5 shadow-sm text-sm">FF</span>
              <span>FileFix</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/convert-files" className="hover:text-blue-600 transition-colors">Convert Files</Link>
              <Link href="/image-studio" className="hover:text-blue-600 transition-colors">Image Studio</Link>
              <Link href="/application-studio" className="hover:text-blue-600 transition-colors">Application Studio</Link>
              <Link href="/pdf-studio" className="hover:text-blue-600 transition-colors">PDF Studio</Link>
              <Link href="/extract-text" className="hover:text-blue-600 transition-colors">Extract Text</Link>
            </nav>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                100% In-Browser Privacy
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} FileFix. Privacy-by-default file utility platform.</p>
            <p className="flex items-center gap-4">
              <span>Local-first processing</span>
              <span>•</span>
              <span>Zero server retention</span>
              <span>•</span>
              <span>No registration needed</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

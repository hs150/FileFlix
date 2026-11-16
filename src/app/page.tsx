import Link from "next/link";
import { Image as ImageIcon, FileText, FileSearch, ShieldCheck, Zap, Lock, FileCheck, ArrowLeftRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-First & Client-Side File Engine</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          Fix, convert, and compress files with <span className="text-blue-600">zero upload privacy</span>.
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
          Solve immediate file requirements without accounts, paywalls, or sending your files to a server. 
          Everything runs entirely inside your browser sandbox.
        </p>
      </section>

      {/* Primary Tool Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Convert Files */}
        <Link
          href="/convert-files"
          className="group block p-6 bg-white rounded-2xl border border-slate-200 hover:border-blue-600 hover:shadow-lg transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Convert Files
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">Hub Live</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Transform JPEG, PNG, WebP images and PDF documents locally. Single or batch image-to-PDF, PDF-to-image ZIP export.
          </p>
          <div className="text-xs text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open File Converter &rarr;
          </div>
        </Link>

        {/* Application Studio */}
        <Link
          href="/application-studio"
          className="group block p-6 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileCheck className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              Application Studio
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700">P1 Live</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Prepare photos and signatures for U.S. Visas, Passports, UPSC, and SSC applications with exact pixel and KB validation.
          </p>
          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open Application Studio &rarr;
          </div>
        </Link>

        {/* Image Studio */}
        <Link
          href="/image-studio"
          className="group block p-6 bg-white rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Image Studio
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">P0 Live</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Resize, crop, and compress JPEG, PNG, and WebP images. Set exact dimensions, maintain aspect ratio, or target a specific file size (KB).
          </p>
          <div className="text-xs text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open Image Studio &rarr;
          </div>
        </Link>

        {/* PDF Studio */}
        <Link
          href="/pdf-studio"
          className="group block p-6 bg-white rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-lg transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              PDF Studio
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-700">P0 Live</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Merge multiple PDFs, split pages, extract page ranges, reorder, and rotate pages locally with zero file retention.
          </p>
          <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open PDF Studio &rarr;
          </div>
        </Link>

        {/* Text Extraction */}
        <Link
          href="/extract-text"
          className="group block p-6 bg-white rounded-2xl border border-slate-200 hover:border-violet-500 hover:shadow-lg transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileSearch className="w-6 h-6" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
              Text Extraction
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-violet-100 text-violet-700">P1 Live</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Extract text from digital PDFs page-by-page. Differentiates text-based from scanned PDFs honestly with direct export.
          </p>
          <div className="text-xs text-violet-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open Text Extraction &rarr;
          </div>
        </Link>
      </section>

      {/* Transparency & Core Guarantees */}
      <section className="bg-slate-100/70 border border-slate-200/80 rounded-2xl p-6 sm:p-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">
          Architectural Transparency & Guarantees
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>100% In-Browser</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Files are processed entirely on your device via HTML5 Canvas, Web Workers, and WebAssembly. No file bytes are uploaded to remote servers.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <Zap className="w-4 h-4 text-blue-600" />
              <span>Instant & Limitless</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              No daily conversion quotas, artificial delays, or email gates. Your machine does the work at maximum hardware speed.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Content-Validated</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Strict magic-byte header validation verifies actual file format, protecting against corrupted files and spoofed extensions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

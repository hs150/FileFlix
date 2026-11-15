import type { Metadata } from 'next';
import { PDFStudioView } from '@/features/pdf-studio/components/PDFStudioView';
import { ShieldCheck, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'PDF Studio — Merge, Split, Rotate & Reorder PDFs Locally | FileFix',
  description:
    'Combine multiple PDF files, rotate individual pages, extract page ranges, and reorder document structure locally in your browser. 100% private with zero file uploads.',
};

export default function PDFStudioPage() {
  return (
    <div className="space-y-12">
      <PDFStudioView />

      {/* Technical and Privacy Information */}
      <section className="border-t border-slate-200 pt-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">How PDF Studio Works</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            PDF Studio operates using client-side WebAssembly and JavaScript binary processing via <code>pdf-lib</code>. 
            All document assembly, page copying, and orientation adjustments happen entirely within your local browser sandbox.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Features & Guarantees</span>
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li><strong>Merge:</strong> Combine unlimited PDF documents in your specified sequence.</li>
              <li><strong>Rotate:</strong> Adjust page orientation in 90-degree increments per page or for all pages.</li>
              <li><strong>Split & Extract:</strong> Pick exact pages to keep; unselected pages are cleanly discarded.</li>
              <li><strong>Output Verification:</strong> Each exported PDF is re-parsed and validated in memory before download.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Encrypted Document Policy</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              If an uploaded PDF is password-protected or uses proprietary security locks, FileFix will transparently report an encrypted file notice. In accordance with security standards, FileFix does not bypass document passwords or tamper with digital rights encryption.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

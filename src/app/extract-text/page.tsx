import type { Metadata } from 'next';
import { TextExtractionView } from '@/features/text-extraction/components/TextExtractionView';
import { ShieldCheck, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Extract Text from PDF — Local & Private PDF Text Extractor | FileFix',
  description:
    'Extract text from PDF documents page by page directly in your browser. Distinguishes text-based from scanned PDFs honestly with instant .txt export and zero server uploads.',
};

export default function ExtractTextPage() {
  return (
    <div className="space-y-12">
      <TextExtractionView />

      {/* Technical and Privacy Information */}
      <section className="border-t border-slate-200 pt-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">How Text Extraction Works</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            FileFix processes PDF text streams directly inside client-side memory using <code>pdfjs-dist</code>. 
            All font rendering tables, text matrix calculations, and page boundary extractions occur locally in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Digital Text vs Scanned PDFs</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This tool extracts digital text streams encoded inside modern PDFs. If a document consists of photographs or flat scans (such as phone camera photos of paper), the file lacks digital text. FileFix transparently detects these pages and informs you that OCR is required rather than producing gibberish.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Table & Layout Caveat</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Text is extracted preserving top-to-bottom reading order. Complex multi-column layouts and visual data tables are presented as readable line flows, but are not guaranteed to align as structured spreadsheet columns.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

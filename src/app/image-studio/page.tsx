import type { Metadata } from 'next';
import { ImageStudioView } from '@/features/image-studio/components/ImageStudioView';
import { ShieldCheck, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Image Studio — Resize, Crop & Compress Images Locally | FileFix',
  description:
    'Free client-side image editor to resize, crop, convert, and compress JPEG, PNG, and WebP images. Set exact dimensions or target file size in KB. 100% private in-browser processing.',
};

export default function ImageStudioPage() {
  return (
    <div className="space-y-12">
      {/* Interactive Tool View */}
      <ImageStudioView />

      {/* Structured Technical & Privacy Information */}
      <section className="border-t border-slate-200 pt-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">How Image Studio Works</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Image Studio performs 100% of its computation directly inside your device&apos;s browser memory. 
            When you select an image, it is read into a private HTML5 Canvas rendering buffer. No bytes are sent to any remote server or cloud API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Supported Formats & Constraints</span>
            </h3>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li><strong>Input Formats:</strong> JPEG, PNG, WebP, and GIF.</li>
              <li><strong>Output Formats:</strong> JPEG (lossy, compact), WebP (modern, high fidelity), PNG (lossless).</li>
              <li><strong>File Size Limit:</strong> Up to 50 MB per image to guarantee smooth browser performance without memory exhaustion.</li>
              <li><strong>Transparency:</strong> Preserved in PNG and WebP; cleanly flattened to white in JPEG.</li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Target File Size (KB) Behavior</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Target file size uses a bounded iterative binary search over encoding parameters. If an exact target size is mathematically unattainable at original dimensions (e.g. asking for 10 KB on a 4K photo), FileFix provides transparent feedback and optional dimension downscaling rather than destroying image quality.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

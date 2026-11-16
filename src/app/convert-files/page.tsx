import type { Metadata } from 'next';
import ConvertFilesView from '@/features/converter/components/ConvertFilesView';

export const metadata: Metadata = {
  title: 'Convert Files — 100% In-Browser Multi-Format File Converter | FileFix',
  description:
    'Convert JPEG, PNG, WebP, and PDF documents completely locally in your browser memory. Zero file uploads, zero server retention, zero tracking.',
};

export default function ConvertFilesPage() {
  return <ConvertFilesView />;
}

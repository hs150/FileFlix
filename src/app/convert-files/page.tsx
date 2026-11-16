import type { Metadata } from 'next';
import ConverterWorkspace from '@/features/conversion-engine/components/ConverterWorkspace';

export const metadata: Metadata = {
  title: 'Universal File Converter — 100% In-Browser File Conversion Engine | FileFix',
  description:
    'Convert Archives, Spreadsheets, Data files, Vector Graphics, eBooks, Images, and PDFs completely locally inside your browser memory. Zero file uploads, zero server tracking.',
};

export default function ConvertFilesPage() {
  return <ConverterWorkspace />;
}

import { Metadata } from 'next';
import { ApplicationStudioView } from '@/features/application-studio/components/ApplicationStudioView';

export const metadata: Metadata = {
  title: 'Application Studio — Official Government, Visa & Exam Preset Optimizer | FileFix',
  description:
    'Prepare and resize passport photos, visa photographs, and exam signatures to official technical specifications. Strict pixel and KB validation, 100% in-browser privacy.',
};

export default function ApplicationStudioPage() {
  return <ApplicationStudioView />;
}

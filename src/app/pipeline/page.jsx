import AppHeader from '@/components/AppHeader';
import PipelineTab from '@/components/PipelineTab';

// CSS cua module import O DAY (route level), KHONG o layout.jsx — de khong bao gio
// tai cung luc voi engine.css cua trang phan tich. Moi selector ben trong da scope
// duoi #pipeline-root nen khong the ro ri, nhung tach o day la lop bao ve thu 2.
import './pipeline.css';

// Module thao tac DOM va fetch data o phia client -> khong prerender tinh.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'OnPoint · VA Distribution Performance',
  description: 'Pipeline tracker: Potential → Verbal Agreement & Onboarding → Go Live',
};

export default function PipelinePage() {
  return (
    <main style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <AppHeader current="pipeline" />
      <PipelineTab />
    </main>
  );
}

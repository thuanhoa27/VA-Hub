import AppHeader from '@/components/AppHeader';
import RunHistory from '@/components/RunHistory';

export const dynamic = 'force-dynamic';

export default function RunsPage() {
  return (
    <main style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <AppHeader current="runs" />
      <RunHistory />
    </main>
  );
}

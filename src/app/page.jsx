import AppHeader from '@/components/AppHeader';
import BrandHuntApp from '@/components/BrandHuntApp';

// App doc DB o phia client va thao tac DOM -> khong prerender tinh.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <main style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <AppHeader current="analyze" />
      <BrandHuntApp />
    </main>
  );
}

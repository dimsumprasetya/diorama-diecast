import { lazy, Suspense } from 'react';
import { useLocation } from './router.ts';
import { Configurator } from './ui/Configurator.tsx';

const OrderPage = lazy(() => import('./pages/OrderPage.tsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.tsx'));

export function App() {
  const { path, search } = useLocation();
  const order = path.match(/^\/pesanan\/([A-Z0-9-]+)/i);
  return (
    <Suspense fallback={<div className="boot"><div className="boot-logo">H</div></div>}>
      {order ? (
        <OrderPage id={order[1]} accessKey={new URLSearchParams(search).get('k') ?? ''} />
      ) : path.startsWith('/admin') ? (
        <AdminPage />
      ) : (
        <Configurator />
      )}
    </Suspense>
  );
}

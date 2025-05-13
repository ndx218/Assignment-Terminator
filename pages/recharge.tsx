// /pages/recharge.tsx
import dynamic from 'next/dynamic';

const RechargeContent = dynamic(() => import('@/components/RechargeContent'), {
  ssr: false,
});

export default function RechargePage() {
  return <RechargeContent />;
}

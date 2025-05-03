// pages/index.tsx
export { default } from '@/components/ui/EasyWorkUI';

export const getServerSideProps = () => {
  return {
    props: {}, // 避免 Next.js 預先靜態生成，確保 useSession() 僅在 client 執行
  };
};

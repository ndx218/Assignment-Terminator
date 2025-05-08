import './globals.css';
import ClientRootProvider from './ClientRootProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <ClientRootProvider>{children}</ClientRootProvider>
      </body>
    </html>
  );
}

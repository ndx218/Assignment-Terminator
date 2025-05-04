import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import Sidebar from '@/components/Sidebar'
import PointBalance from '@/components/PointBalance'

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 relative">
          <Component {...pageProps} />
          <PointBalance />
        </main>
      </div>
    </SessionProvider>
  )
}

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Sidebar from '@/components/Sidebar'
import PointBalance from '@/components/PointBalance'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 relative">
        <Component {...pageProps} />
        <PointBalance />
      </main>
    </div>
  )
}

// pages/api/auth/[...nextauth].ts
import NextAuth from 'next-auth';
import { authOptions } from '@/server/authOptions'; // ✅ 正確路徑

console.log('💡 [auth] API route hit');

export default NextAuth(authOptions);

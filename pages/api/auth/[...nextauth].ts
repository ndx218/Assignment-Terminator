// pages/api/auth/[...nextauth].ts
import NextAuth from 'next-auth';
import authOptions from '@/lib/auth';

console.log('💡 [auth] API route hit');

export default NextAuth(authOptions);

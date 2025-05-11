export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60,       // ✅ 一年有效
    updateAge: 30 * 24 * 60 * 60,     // ✅ 每 30 天刷新一次
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.phone = (user as any).phone ?? null;
        token.referredBy = (user as any).referredBy ?? null;
        token.referralCode = (user as any).referralCode ?? null;
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.phone = token.phone ?? null;
        session.user.referredBy = token.referredBy ?? null;
        session.user.referralCode = token.referralCode ?? null;
      }
      return session;
    },

    async signIn({ user }) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email ?? undefined },
      });

      if (dbUser) {
        (user as any).phone = dbUser.phone ?? null;
        (user as any).referredBy = dbUser.referredBy ?? null;
        (user as any).referralCode = dbUser.referralCode ?? null;
      }

      return true;
    },
  },
};

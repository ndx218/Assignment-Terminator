import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma'; // 确保您的 Prisma Client 导入路径正确
import { serialize } from 'cookie';
import { sign } from 'jsonwebtoken'; // 通常用于创建JWT session，如果您使用NextAuth.js，可能不需要手动管理
import { getToken } from 'next-auth/jwt'; // 引入getToken，如果您使用NextAuth.js的JWT策略

// 确保您的 NEXTAUTH_SECRET 在 .env.local 中定义
const JWT_SECRET = process.env.NEXTAUTH_SECRET;

if (!JWT_SECRET) {
  throw new Error('NEXTAUTH_SECRET is not defined in environment variables.');
}

// 假设这是您的电话验证流程，它会生成一个sessionToken并设置cookie
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ message: 'Phone and code are required.' });
  }

  try {
    // 1. 验证验证码
    const verificationCode = await prisma.verificationCode.findUnique({
      where: { phone },
    });

    if (!verificationCode || verificationCode.code !== code) {
      return res.status(401).json({ message: 'Invalid or expired verification code.' });
    }

    // 可选：删除已使用的验证码
    await prisma.verificationCode.delete({
      where: { phone },
    });

    // 2. 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // 用户不存在，创建新用户
      user = await prisma.user.create({
        data: {
          phone,
          // 如果您希望新注册用户有默认的积分或推荐码，可以在这里设置
          credits: 0,
          // referralCode: 'generate_a_unique_code_here', // 示例：生成一个
        },
      });
    }

    // 3. 生成 Session Token (与 NextAuth.js 兼容)
    // NextAuth.js 的 `sessionToken` 应该是一个安全的、唯一的字符串。
    // 通常 NextAuth.js 会为您生成这个，但如果您在自定义登录流中需要它，
    // 您可以使用 NextAuth.js 内部的 `createToken` 或手动生成一个足够安全的 UUID/CUID。
    // 这里我们直接使用一个 CUID 作为 sessionToken
    const sessionToken = await prisma.session.create({
      data: {
        userId: user.id,
        // NextAuth.js Session 模型需要 expires 字段
        // 设置一个合理的过期时间，例如 30 天
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30天后过期
        // sessionToken 字段需要一个唯一值。我们可以使用 Prisma 的 cuid() 或 uuid()
        // 但为了保持与 NextAuth.js 的 Prisma 适配器行为一致，
        // 这里的 `sessionToken` 应该是一个独立的、唯一的字符串，而不是直接使用 `cuid()` 作为记录 ID。
        // NextAuth.js 内部通常会生成一个 JWT 作为 sessionToken。
        // 如果您的 NextAuth.js 配置是数据库会话策略，那么它会期望这里直接创建一个数据库 Session 记录。
        // 在这里，为了解决编译错误，我们将其修正为 `sessionToken` 字段。
        // 关键是，这个 `sessionToken` 的值需要是唯一的。
        // 简单的做法是，如果您的 NextAuth.js 适配器负责管理 Sessions，
        // 这个 `verify-code.ts` 文件可能不应该直接创建 `Session` 记录，
        // 而是应该通过 `signIn` 回调或 `jwt` 回调来处理。
        //
        // 考虑到您遇到的编译错误，最直接的修复是确保 `data` 对象的字段名匹配。
        // 如果您希望手动生成一个用于会话的令牌，可以使用 `sign` 函数来生成一个 JWT。
        sessionToken: sign({ userId: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '30d' }), // 使用JWT作为sessionToken
      },
    }).then(session => session.sessionToken); // 获取新创建的 sessionToken

    // 4. 设置 HttpOnly Cookie
    res.setHeader('Set-Cookie', serialize('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 仅在生产环境使用 HTTPS
      maxAge: 60 * 60 * 24 * 30, // 30天
      path: '/',
      sameSite: 'Lax', // 推荐使用 Lax 或 Strict
    }));

    // 5. 返回成功响应和用户信息
    return res.status(200).json({ message: 'Login successful', user });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
}

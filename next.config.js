// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    // 如你使用了 zh-convert，在 SWC 里启用对第三方包的 ES 模块支持
    styledComponents: true,
  },
  // 如果你用到了图片优化、国际化等，也可以在这里补充：
  // images: { domains: ['your.cdn.com'] },
  // i18n: { locales: ['zh-CN','zh-TW'], defaultLocale: 'zh-TW' },
}

module.exports = nextConfig

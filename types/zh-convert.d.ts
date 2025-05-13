// types/zh-convert.d.ts
declare module 'zh-convert' {
  const zhConvert: {
    s2t: (text: string) => string;
    t2s: (text: string) => string;
  };
  export default zhConvert;
}

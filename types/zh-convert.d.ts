declare module 'zh-convert' {
  const zhConvert: {
    s2t: (input: string) => string;
    t2s: (input: string) => string;
  };
  export default zhConvert;
}

export const siteConfig = {
  name: 'Imjingak Pyeonghwa Nuri Park',
  baseUrl: 'https://imjingakpeacepark.com',
  slug: 'imjingak-pyeonghwa-nuri-park',
  locales: ['zh', 'en', 'ja', 'ko'] as const,
};

export const ogLocale: Record<string, string> = {
  zh: 'zh_CN',
  en: 'en_US',
  ja: 'ja_JP',
  ko: 'ko_KR',
};

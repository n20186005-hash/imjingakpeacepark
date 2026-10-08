import type { APIRoute } from 'astro';
import { languagesList } from '../i18n/ui';

const base = 'https://imjingakpeacepark.com';

// 与 src/pages/[lang]/ 下的路由保持一致
const routes: { path: string; priority: string; changefreq: string }[] = [
  { path: '', priority: '1.0', changefreq: 'weekly' },
  { path: 'privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: 'terms-of-service', priority: '0.3', changefreq: 'yearly' },
  { path: 'cookie-settings', priority: '0.3', changefreq: 'yearly' },
  { path: 'getting-there', priority: '0.7', changefreq: 'monthly' },
  { path: 'getting-there-by-train', priority: '0.6', changefreq: 'monthly' },
  { path: 'getting-there-by-bus', priority: '0.6', changefreq: 'monthly' },
  { path: 'imjingak-dmz-guide', priority: '0.7', changefreq: 'monthly' },
  { path: 'photos', priority: '0.6', changefreq: 'monthly' },
];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = languagesList.flatMap((lang) =>
    routes.map((route) => {
      const loc = `${base}/${lang}${route.path ? '/' + route.path : ''}/`;
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
  ).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

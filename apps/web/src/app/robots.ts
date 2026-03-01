import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://myshop.uz';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin/', '/seller/', '/checkout'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

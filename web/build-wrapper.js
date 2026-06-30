import { spawnSync } from 'node:child_process';

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ Error: VITE_CONVEX_URL is not set.");
  process.exit(1);
}

const convexSiteUrl = convexUrl.replace('.cloud', '.site');
process.env.VITE_CONVEX_SITE_URL = convexSiteUrl;

console.log("=========================================");
console.log("🚀 CI Build Wrapper Configuration");
console.log(`- VITE_CONVEX_URL:      ${convexUrl}`);
console.log(`- VITE_CONVEX_SITE_URL: ${process.env.VITE_CONVEX_SITE_URL}`);
console.log(`- CLOUDFLARE_ENV:       ${process.env.CLOUDFLARE_ENV || 'not set'}`);
console.log(`- VITE_BACKEND_URL:     ${process.env.VITE_BACKEND_URL || 'not set'}`);
console.log(`- BETTER_AUTH_SECRET:   ${process.env.BETTER_AUTH_SECRET ? '✅ Configured (masked)' : '❌ Not Configured'}`);
console.log("=========================================");

const result = spawnSync('pnpm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

process.exit(result.status ?? 1);

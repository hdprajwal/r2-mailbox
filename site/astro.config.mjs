import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { unified } from '@astrojs/markdown-remark';
import rehypeDocLinks from './src/lib/rehype-doc-links.mjs';
import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs';
import rehypeDiagrams from './src/lib/rehype-diagrams.mjs';

export default defineConfig({
  site: 'https://r2-mailbox.hdprajwal.dev',
  trailingSlash: 'always',
  markdown: {
    // Same Shiki pair as the portfolio; colors switch with the .dark class.
    shikiConfig: {
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      defaultColor: false,
    },
    processor: unified({ rehypePlugins: [rehypeDocLinks, rehypeWrapTables, rehypeDiagrams] }),
  },
  vite: { plugins: [tailwindcss()] },
});

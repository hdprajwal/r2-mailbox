import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// The site renders the repo's docs/ folder as is, so GitHub and the site
// always show the same text.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../docs' }),
});

export const collections = { docs };

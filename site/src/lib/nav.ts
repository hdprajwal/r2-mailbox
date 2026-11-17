import { docPathToUrl } from './routes.mjs';

// Sidebar groups and reading order, the same as docs/README.md.
// Each id is a docs/ path without .md; prev/next links follow this order.
export const sections = [
  {
    label: 'Get started',
    pages: [
      { id: 'README', label: 'Overview' },
      { id: 'getting-started', label: 'Set up your inbox' },
      { id: 'setup-with-an-ai-agent', label: 'Set up with an AI agent' },
    ],
  },
  {
    label: 'Guides',
    pages: [
      { id: 'reading-mail', label: 'Read your mail' },
      { id: 'agents-and-scripts', label: 'Scripts and AI agents' },
      { id: 'managing-your-inbox', label: 'Manage your inbox' },
      { id: 'troubleshooting', label: 'Troubleshooting' },
      { id: 'development', label: 'Change the code' },
    ],
  },
  {
    label: 'Concepts',
    pages: [{ id: 'how-it-works', label: 'How it works' }],
  },
  {
    label: 'Reference',
    pages: [
      { id: 'reference/reader', label: 'Reader' },
      { id: 'reference/worker', label: 'Worker and setup' },
    ],
  },
];

export const order = sections.flatMap((s) => s.pages);

export const pageUrl = (id: string) => docPathToUrl(`${id}.md`);

// Diagram specs. Docs embed one with a <picture data-diagram="id"> block;
// the site swaps in the live diagram and GitHub shows the PNGs that
// `npm run diagrams` renders from these same specs.
//
// Node height: 48 tile + 8 gap + 23 name + 18 per role. A one-role node
// starting at `top` ends at top + 97; a two-role node at top + 115.

/** How an email reaches your code. Used by how-it-works and getting-started. */
const mailFlow = {
  id: 'mail-flow',
  description:
    'How an email reaches your code. A sender’s mail server delivers to your address on Cloudflare. Inside Cloudflare, Email Routing receives the email and runs the r2-mailbox Worker, which checks it and writes it to the R2 bucket as one .eml file. On your machine, the reader downloads emails from the bucket with a read-only key and gives your script or agent JSON.',
  width: 640,
  height: 560,
  groups: [
    {
      label: 'Cloudflare',
      icon: 'cloudflare',
      variant: 'vendor',
      left: 252,
      top: 20,
      width: 368,
      height: 312,
    },
    {
      label: 'Your machine',
      icon: 'Laptop',
      variant: 'neutral',
      left: 196,
      top: 372,
      width: 424,
      height: 168,
    },
  ],
  edges: [
    {
      d: 'M130 84 H300',
      kind: 'primary',
      label: { text: 'SMTP', x: 190, y: 76 },
    },
    {
      d: 'M360 84 H500',
      kind: 'primary',
      label: { text: 'runs', x: 430, y: 76 },
    },
    {
      d: 'M530 163 V204',
      kind: 'primary',
      label: { text: 'writes', x: 520, y: 188, anchor: 'end' },
    },
    {
      d: 'M530 313 V414',
      kind: 'primary',
      label: { text: 'read-only key', x: 540, y: 361, anchor: 'start' },
    },
    {
      d: 'M500 444 H330',
      kind: 'primary',
      label: { text: 'JSON', x: 415, y: 436 },
    },
  ],
  nodes: [
    { cx: 100, top: 60, icon: 'Send', name: 'Sender', roles: ['any mail server'] },
    {
      cx: 330,
      top: 60,
      icon: 'Mail',
      name: 'Email Routing',
      roles: ['your address'],
    },
    { cx: 530, top: 60, icon: 'Cpu', name: 'Worker', roles: ['checks it'] },
    {
      cx: 530,
      top: 210,
      icon: 'Archive',
      name: 'R2 bucket',
      roles: ['one .eml per email'],
    },
    {
      cx: 530,
      top: 420,
      icon: 'python',
      name: 'Reader',
      roles: [{ code: 'mailbox.py' }],
    },
    {
      cx: 300,
      top: 420,
      icon: 'Bot',
      name: 'Your code',
      roles: ['script, cron, or agent'],
    },
  ],
  legend: [{ kind: 'primary', text: 'Path of an email' }],
};

/** The Worker's checks, in order. Used by the Worker reference. */
const workerChecks = {
  id: 'worker-checks',
  description:
    'The checks the Worker runs on each email, in order. First the size: an email over 20 MiB is rejected. Then the sender, against ALLOWED_SENDERS. Then the DMARC result, if REQUIRE_DMARC is on. An email that fails any check is rejected: the sender gets a bounce and nothing is stored. An email that passes all three is saved to R2, then forwarded if FORWARD_TO is set.',
  width: 640,
  height: 720,
  groups: [],
  edges: [
    {
      d: 'M180 127 V158',
      kind: 'primary',
      label: { text: 'passes', x: 170, y: 147, anchor: 'end' },
    },
    {
      d: 'M180 267 V298',
      kind: 'primary',
      label: { text: 'passes', x: 170, y: 287, anchor: 'end' },
    },
    {
      d: 'M180 407 V438',
      kind: 'primary',
      label: { text: 'passes', x: 170, y: 427, anchor: 'end' },
    },
    {
      d: 'M180 547 V578',
      kind: 'primary',
      label: { text: 'then', x: 170, y: 567, anchor: 'end' },
    },
    {
      d: 'M210 48 H470 V158',
      kind: 'internal',
      label: { text: 'too large', x: 330, y: 40 },
    },
    {
      d: 'M210 188 H440',
      kind: 'internal',
      label: { text: 'not on the list', x: 330, y: 180 },
    },
    {
      d: 'M210 328 H470 V285',
      kind: 'internal',
      label: { text: 'not a pass', x: 330, y: 320 },
    },
  ],
  nodes: [
    { cx: 180, top: 24, icon: 'Weight', name: 'Size', roles: ['20 MiB or less'] },
    {
      cx: 180,
      top: 164,
      icon: 'UserCheck',
      name: 'Sender',
      roles: [{ code: 'ALLOWED_SENDERS' }],
    },
    {
      cx: 180,
      top: 304,
      icon: 'ShieldCheck',
      name: 'DMARC',
      roles: [{ code: 'REQUIRE_DMARC' }],
    },
    {
      cx: 180,
      top: 444,
      icon: 'Archive',
      name: 'Save to R2',
      roles: ['one .eml file'],
    },
    {
      cx: 180,
      top: 584,
      icon: 'Forward',
      name: 'Forward a copy',
      roles: [{ code: 'FORWARD_TO' }, 'if set'],
    },
    {
      cx: 470,
      top: 164,
      icon: 'Ban',
      name: 'Rejected',
      roles: ['sender gets a bounce', 'nothing is stored'],
    },
  ],
  legend: [
    { kind: 'primary', text: 'Passes the check' },
    { kind: 'internal', text: 'Fails the check' },
  ],
};

/** A scheduled export feeding your own code. Used by agents-and-scripts. */
const scheduledExport = {
  id: 'scheduled-export',
  description:
    'A scheduled export on your machine. Cron runs daily-mail.sh every morning. The script runs the reader’s export command, which writes mail.json, and then runs your code. Your code reads mail.json, skips the keys it has already handled, and passes only the new emails to your AI agent.',
  width: 640,
  height: 360,
  groups: [
    {
      label: 'Your machine',
      icon: 'Laptop',
      variant: 'neutral',
      left: 12,
      top: 16,
      width: 616,
      height: 328,
    },
  ],
  edges: [
    {
      d: 'M120 88 H290',
      kind: 'internal',
      label: { text: 'runs', x: 205, y: 80 },
    },
    {
      d: 'M350 88 H520',
      kind: 'internal',
      label: { text: 'runs', x: 435, y: 80 },
    },
    {
      d: 'M320 167 V218',
      kind: 'internal',
      label: { text: 'then runs', x: 330, y: 197, anchor: 'start' },
    },
    {
      d: 'M550 167 V218',
      kind: 'primary',
      label: { text: 'writes', x: 560, y: 197, anchor: 'start' },
    },
    {
      d: 'M520 248 H350',
      kind: 'primary',
      label: { text: 'reads', x: 435, y: 240 },
    },
    {
      d: 'M290 248 H120',
      kind: 'primary',
      label: { text: 'new emails', x: 205, y: 240 },
    },
  ],
  nodes: [
    { cx: 90, top: 64, icon: 'Clock', name: 'Cron', roles: ['07:00 daily'] },
    {
      cx: 320,
      top: 64,
      icon: 'Terminal',
      name: 'Wrapper script',
      roles: [{ code: 'daily-mail.sh' }],
    },
    {
      cx: 550,
      top: 64,
      icon: 'python',
      name: 'Reader',
      roles: [{ code: 'export' }],
    },
    {
      cx: 550,
      top: 224,
      icon: 'FileJson',
      name: 'Export file',
      roles: [{ code: 'mail.json' }],
    },
    {
      cx: 320,
      top: 224,
      icon: 'ListChecks',
      name: 'Your code',
      roles: ['skips handled keys'],
    },
    {
      cx: 90,
      top: 224,
      icon: 'Bot',
      name: 'AI agent',
      roles: ['gets new emails'],
    },
  ],
  legend: [
    { kind: 'internal', text: 'Starts the next step' },
    { kind: 'primary', text: 'Email data' },
  ],
};

export const diagrams = { mailFlow, workerChecks, scheduledExport };
export const diagramsById = Object.fromEntries(
  Object.values(diagrams).map((d) => [d.id, d])
);

# Set up your inbox with an AI agent

An AI coding agent that can run commands on your machine, such as Claude Code, can do most of the [setup tutorial](getting-started.md) for you. This page gives you a prompt to paste into the agent, explains which steps still need you, and shows how to check the result.

## What the agent does and what you do

The agent runs every command, but a few steps happen in your browser or involve a secret, so it hands those to you:

- **The agent**: clones the repo, installs the tools, checks your domain’s mail records, creates the bucket and delete rule, deploys the Worker, writes the config file, and tests the inbox
- **You**: approve the Cloudflare login, turn on Email Routing, create the routing rule and the read-only key in the dashboard, paste the key into the config file, and send a test email

The prompt tells the agent never to ask for your secret key in the chat. You paste it into the config file yourself, so it never ends up in the agent’s conversation history.

## Before you start

Make sure you have what the tutorial needs:

- A Cloudflare account with R2 turned on
- A domain with its DNS on Cloudflare
- Node.js 20 or newer, Python 3.9 or newer, `git`, and `curl`
- An AI agent that can run shell commands on your machine

Open the agent in the folder where you want the `r2-mailbox` folder to go.

## Copy the prompt

Fill in the three settings at the top, then paste the whole prompt into your agent:

```text
Set up r2-mailbox for me: https://github.com/hdprajwal/r2-mailbox

My settings:
- Address: inbox@yourdomain.com
- Keep emails for: 30 days (0 keeps them forever)
- Only accept mail from: anyone
  (or a comma-separated list, like @substack.com,alerts@example.com)

Clone the repo and read docs/getting-started.md before you start. Follow
it one step at a time, and check that each step worked before the next.

Rules:
- Ask me before anything that changes my Cloudflare account or DNS.
- Some steps need me in the browser: the Wrangler login, turning on
  Email Routing, creating the routing rule, and creating the R2 API
  token. Tell me exactly where to click, then wait until I say I'm done.
- Never ask me to paste a secret into this chat. When the read-only key
  is ready, tell me which file and fields to fill in, and wait for me.
- Before Email Routing is turned on, check the domain's MX records with
  `dig +short MX <domain>`. If they point to another email provider,
  stop and suggest a subdomain like mail.<domain> instead.
- If a command fails, show me the error and check docs/troubleshooting.md
  before you try something else.

Steps:
1. Run npm install, then have me log in with npx wrangler login. If
   npx wrangler whoami lists more than one account, ask me which one.
2. Check that Email Routing is on for the domain. If it isn't, walk me
   through turning it on.
3. If I gave a sender list, set ALLOWED_SENDERS in worker/wrangler.jsonc.
   Then run RETENTION_DAYS=<my days> npm run setup.
4. Walk me through routing my address to the r2-mailbox Worker.
5. Walk me through creating an R2 API token with Object Read only on the
   r2-mailbox bucket only. Create ~/.config/r2-mailbox/config.json from
   config.example.json with chmod 600, and fill in account_id and bucket.
   Then let me fill in access_key_id and secret_access_key myself.
6. Run python3 reader/mailbox.py check.
7. Ask me to send a test email to my address. Wait a few seconds, then
   run python3 reader/mailbox.py list --hours 1 and show me the result.

When it works, summarize what you set up: the address, the bucket, the
delete rule, the sender list if any, and where the config file is.
```

The prompt points the agent at the tutorial in the repo instead of repeating it, so the agent follows the same steps you’d follow by hand.

## Check what the agent set up

When the agent says it’s done, confirm these three things yourself:

1. `python3 reader/mailbox.py list --hours 1` shows your test email.
2. `npx wrangler r2 bucket lifecycle list r2-mailbox` shows the delete rule, unless you chose to keep emails forever.
3. `~/.config/r2-mailbox/config.json` is readable only by you. `ls -l` shows `-rw-------`.

If the test email never shows up, see [Nothing shows up after a test email](troubleshooting.md#nothing-shows-up-after-a-test-email).

## Change the prompt for your setup

The prompt covers the default setup. Edit it before you paste it if you need something different:

- **A different bucket name**: add “Use the bucket name my-inbox” to the settings. The agent then changes `bucket_name` in `worker/wrangler.jsonc` and passes `BUCKET` to the setup script.
- **A copy in your normal inbox**: add “Forward a copy to you@example.com”. The address has to be a verified destination in Email Routing, so the agent walks you through verifying it first. See [Forward a copy of every email](managing-your-inbox.md#forward-a-copy-of-every-email).
- **Require DMARC**: add “Reject email that fails DMARC”. The agent sets `REQUIRE_DMARC` to `true`. See [Require a DMARC pass](managing-your-inbox.md#require-a-dmarc-pass) before you turn it on.

## Next steps

Once your inbox works, you can have the same agent build on it:

- [Send your mail to a script or AI agent](agents-and-scripts.md) on a schedule
- [Limit who can send to your address](managing-your-inbox.md#accept-email-only-from-senders-you-expect), which matters when an agent reads the mail

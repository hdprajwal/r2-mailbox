# r2-mailbox

r2-mailbox gives you an email address on your own domain that saves every email it gets into a Cloudflare R2 bucket. You can then read those emails from a script, a cron job, or an AI agent, using a key that can only read that one bucket.

I built it so an agent could have its own inbox for newsletters. It reads the day's issues and picks out what is worth reading, without ever touching my personal email. It works for anything else you want to handle in code too: signup confirmations, alerts, receipts, reports.

It uses three Cloudflare pieces:

- Email Routing receives mail for your address.
- A small Worker saves each email to R2.
- An R2 bucket stores the emails as plain `.eml` files.

```
someone sends mail ──> inbox@yourdomain.com
                              │
                              ▼
                   Cloudflare Email Routing
                              │
                              ▼
                     r2-mailbox Worker ──> R2 bucket (one .eml file per email)
                                                │
your script or agent <── reader/mailbox.py <────┘  (read-only key)
```

## How it stays private

The Worker only has an email handler. It has no web URL, no preview URLs, and no routes, so nobody on the internet can call it. Only Email Routing can send it mail.

To read mail you create an R2 key that can only read objects in this one bucket. It cannot write, delete, or see anything else in your Cloudflare account. If the key leaks, the worst case is someone reads the emails in that bucket.

The Worker has no secrets of its own. It writes to R2 through a binding, which Cloudflare handles for you.

## What you need

- A Cloudflare account. The free plan works.
- A domain with its DNS on Cloudflare. A `*.workers.dev` or `*.pages.dev` address cannot receive email.
- R2 turned on for your account. You do this once in the dashboard under R2.
- Node.js 20 or newer, for Wrangler (Cloudflare's command-line tool).
- Python 3.9 or newer for the reader. It uses only the standard library, so there is nothing to install.

One warning before you start. If your domain already gets email somewhere else, like Google Workspace or Fastmail, do not turn on Email Routing for the main domain. It replaces your MX records and your normal email will stop arriving. Use a subdomain instead, like `mail.yourdomain.com`. You can add one under Email Routing, Settings, Subdomains.

## Setup

This takes about 15 minutes.

### 1. Get the code and log in

```bash
git clone https://github.com/hdprajwal/r2-mailbox.git
cd r2-mailbox
npm install
npx wrangler login
```

`npm install` installs a pinned version of Wrangler and the Cloudflare type definitions. The setup script uses that Wrangler if it is there.

If your login has more than one Cloudflare account, `wrangler whoami` lists them. Either set `account_id` in `worker/wrangler.jsonc` or export `CLOUDFLARE_ACCOUNT_ID`.

### 2. Turn on Email Routing

In the Cloudflare dashboard, open your domain, then Email, then Email Routing, and click Get started. Cloudflare adds the DNS records it needs. You only do this once per domain. If the domain already uses Email Routing, skip this step.

### 3. Create the bucket and deploy the Worker

```bash
npm run setup
```

This runs `scripts/setup.sh`, which does three things:

1. Creates an R2 bucket called `r2-mailbox`.
2. Adds a rule that deletes stored emails after 30 days. Set `RETENTION_DAYS=0` to keep them forever, or another number to change it.
3. Deploys the Worker.

If you want a different bucket name, change `bucket_name` in `worker/wrangler.jsonc` first, then run `BUCKET=your-name ./scripts/setup.sh`.

### 4. Send an address to the Worker

In the dashboard, go to Email Routing, then Routing rules, then Create address. Type the address you want, like `inbox@yourdomain.com`. For the action, choose Send to a Worker and pick `r2-mailbox`.

You can also let the script create the rule. You need an API token with the "Email Routing Rules: Edit" permission on that domain, plus the domain's zone ID. The zone ID is on the domain's Overview page.

```bash
ADDRESS=inbox@yourdomain.com \
ZONE_ID=your-zone-id \
CLOUDFLARE_API_TOKEN=your-token \
./scripts/setup.sh
```

### 5. Create a read-only key

In the dashboard, go to R2, then Manage API tokens, then Create API token.

- Permission: Object Read only
- Bucket: only `r2-mailbox`

When it is created you will see a few values. You need two of them:

- Access Key ID, which is 32 characters
- Secret Access Key, which is 64 characters

Do not use the token value that starts with `cf`. That is a different thing and will not work as the Access Key ID. The secret is only shown once, so copy it now.

Put them in a config file that only you can read:

```bash
mkdir -p ~/.config/r2-mailbox
cp config.example.json ~/.config/r2-mailbox/config.json
chmod 600 ~/.config/r2-mailbox/config.json
```

Then fill in `account_id`, `access_key_id`, and `secret_access_key`. Your account ID is shown on the right side of the dashboard home page, and in `wrangler whoami`.

Check that it works:

```bash
python3 reader/mailbox.py check     # or: npm run check
```

### 6. Send a test email

Send any email to your new address, wait a few seconds, then run:

```bash
python3 reader/mailbox.py list --hours 1
```

You should see the email you just sent. If not, see Troubleshooting below.

## Reading mail

```bash
python3 reader/mailbox.py list   --hours 24            # one line per email: time, sender, subject, key
python3 reader/mailbox.py show   <key>                 # headers, the text of the email, and its links
python3 reader/mailbox.py get    <key> -o email.eml    # the raw email file
python3 reader/mailbox.py export --hours 24 -o mail.json
python3 reader/mailbox.py check                        # test the key and bucket access
```

`export` is the one you want for scripts and agents. It writes a JSON file with one entry per email:

```json
{
  "exported_at": "2026-11-06T22:00:00+00:00",
  "hours": 24,
  "count": 1,
  "messages": [
    {
      "key": "mail/2026-11-06/2026-11-06T21:50:24.407Z-76cd....eml",
      "received": "2026-11-06T21:50:24.407Z",
      "date": "2026-11-06T21:50:23+00:00",
      "from": "TLDR <dan@tldrnewsletter.com>",
      "to": "inbox@yourdomain.com",
      "subject": "TLDR Dev - Confirm your signup",
      "message_id": "<...>",
      "list_id": "",
      "dmarc": "pass",
      "attachments": [],
      "links": [{ "url": "https://...", "text": "Confirm Signup" }],
      "text": "Welcome to TLDR Dev! ..."
    }
  ]
}
```

`text` is the plain text part of the email. If the email only has HTML, the reader pulls the text out of the HTML. `links` lists every link with the text it was attached to. Long bodies are cut at 20,000 characters by default. Use `--max-text 0` to keep them whole.

The reader looks for its settings in this order:

1. `--config path/to/config.json`
2. Environment variables: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and optionally `R2_PREFIX`
3. `~/.config/r2-mailbox/config.json`

### Using another S3 tool

R2 works with S3 tools, so you do not have to use the reader. Emails are stored like this:

```
mail/<YYYY-MM-DD>/<ISO timestamp>-<random id>.eml
```

Each file also has metadata attached: `received`, `envelopeFrom`, `envelopeTo`, `from`, `subject`, `messageId`, and `dmarc`.

With the AWS CLI, for example:

```bash
aws s3 ls s3://r2-mailbox/mail/ --recursive \
  --endpoint-url https://<account_id>.r2.cloudflarestorage.com
```

## Options

You can change how the Worker behaves with these settings in `worker/wrangler.jsonc`, under `vars`. Deploy again after you change them:

```bash
npm run deploy
```

| Setting | Default | What it does |
|---|---|---|
| `ALLOWED_SENDERS` | empty, so everything is accepted | A comma-separated list of addresses or `@domains`. Email from anyone else is rejected. Example: `@substack.com,dan@tldrnewsletter.com` |
| `REQUIRE_DMARC` | `false` | Set to `true` to reject email that fails DMARC, the check that shows an email really came from the domain it claims. |
| `FORWARD_TO` | empty | Also forward a copy of every email to this address. It has to be a verified destination in Email Routing. |
| `PREFIX` | `mail` | The folder name inside the bucket. If you change it, change the prefix in the delete-after-30-days rule too. |

The Worker rejects emails over 20 MB. Email Routing rejects anything over 25 MiB before it reaches the Worker.

For the DMARC check, the Worker only trusts the `Authentication-Results` header that Cloudflare adds itself. A sender cannot fake a pass by adding their own copy of that header.

## Things to keep in mind

Anyone who knows the address can send email to it. Treat what is inside the emails as untrusted, especially if an AI agent reads them. An email can contain text written to trick an agent into doing something. If you only expect mail from a few senders, set `ALLOWED_SENDERS`.

Signup confirmation emails land in the bucket like any other email. The reader never opens links on its own. Whether your code should open them is up to you. Opening them by hand is the safe choice.

The Worker saves emails exactly as they arrive and does not parse them. That keeps it well inside the CPU limit for Workers on the free plan. All the parsing happens in the reader, on your machine.

To change the read key, create a new R2 token, update `config.json`, then delete the old token in the dashboard.

## Cost

Email Routing is free. A personal inbox uses very little Worker time and storage, so it should fit inside the free plans for Workers and R2. I have not measured exact usage, so check the current pricing pages if your volume is high:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Email Routing limits](https://developers.cloudflare.com/email-routing/limits/)

## Troubleshooting

Nothing shows up after a test email:
Check that the routing rule exists and points to the `r2-mailbox` Worker. Then run `npm run tail` and send the test again. You will see the Worker run, or an error if something is wrong.

Email from one sender never arrives:
Email Routing drops email that fails DMARC when the sender's domain asks for that (a `reject` or `quarantine` policy). This happens before the Worker runs, so there is nothing in the logs. If you set `ALLOWED_SENDERS`, also check the sender is on the list.

`R2 returned 403`:
The key is wrong, expired, or not allowed to read this bucket. Make sure you used the 32-character Access Key ID and not the token value that starts with `cf`.

`wrangler deploy` asks which account to use:
Set `account_id` in `worker/wrangler.jsonc`, or export `CLOUDFLARE_ACCOUNT_ID`.

My normal email stopped arriving after I turned on Email Routing:
Email Routing replaced your domain's MX records. Put your old email provider's MX records back, and use a subdomain for r2-mailbox instead.

## Working on the code

```bash
npm install
npm run typecheck    # type-check the Worker against Cloudflare's types
npm run deploy       # deploy the Worker
npm run tail         # watch the Worker's logs live
```

## Project layout

```
worker/src/index.ts     the Email Worker
worker/wrangler.jsonc   Worker config: bucket binding and options
reader/mailbox.py       command-line reader (Python standard library only)
scripts/setup.sh        creates the bucket, the delete rule, deploys, and optionally adds the routing rule
config.example.json     template for the reader config
package.json            pinned Wrangler and TypeScript, plus npm scripts
tsconfig.json           TypeScript settings for the Worker
SECURITY.md             how to report a security problem
```

## Security

If you find a security problem, please report it privately. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

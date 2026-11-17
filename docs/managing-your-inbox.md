# Control which emails your inbox accepts and keeps

You control r2-mailbox through a few settings in `worker/wrangler.jsonc` and a lifecycle rule on the bucket. This page shows how to limit senders, require DMARC, forward copies, change how long emails are kept, rotate the read key, and delete emails.

## Change a Worker setting

Every Worker setting lives under `vars` in `worker/wrangler.jsonc`, and takes effect when you deploy again. After you edit the file, run:

```bash
npm run deploy
```

The sections below each change one setting. For all of them in one table, see the [Worker reference](reference/worker.md#worker-settings).

## Accept email only from senders you expect

`ALLOWED_SENDERS` rejects every email that isn’t from an address or domain on your list. Use it when you only expect mail from a few senders, and always consider it when an AI agent reads the inbox.

Set it to a comma-separated list of full addresses and `@domain` entries:

```jsonc
"ALLOWED_SENDERS": "@substack.com,news@example.com",
```

Matching ignores case. An `@domain` entry matches addresses at that exact domain only, so `@substack.com` doesn’t match `news@mail.substack.com`. Add each subdomain as its own entry.

The Worker checks the envelope sender, the address the sending server gives when it delivers the email. It isn’t always the address in the `From` line: newsletters and mailing lists can send from a separate bounce address, such as `bounces+1234@mail.example.com`.

To find a sender’s envelope address, leave `ALLOWED_SENDERS` empty until one of their emails arrives. Then read the `envelopefrom` metadata on the stored email with an S3 tool, as shown in [Read the bucket with another S3 tool](reading-mail.md#read-the-bucket-with-another-s3-tool).

A rejected sender’s mail server gets a permanent error with the reason `Sender not allowed`, and nothing is stored.

## Require a DMARC pass

`REQUIRE_DMARC` rejects every email whose DMARC result isn’t `pass`. DMARC is the check that shows an email came from the domain in its `From` address. Turn it on to stop emails that pretend to come from a sender you trust:

```jsonc
"REQUIRE_DMARC": "true",
```

This also rejects mail from domains that don’t publish a DMARC policy, which get the result `none`. Before you turn it on, check the `DMARC` line of a few emails you want to keep with `show`. Rejected mail gets the reason `DMARC check failed`.

`REQUIRE_DMARC` and `ALLOWED_SENDERS` work well together. The allow list limits who can send, and DMARC confirms the sender is real.

## Forward a copy of every email

`FORWARD_TO` sends a copy of each stored email to another address, so you can read it in a normal email app too:

```jsonc
"FORWARD_TO": "you@example.com",
```

The address has to be a verified destination in Email Routing. Add it under **Email Routing** > **Destination addresses** and click the link in the confirmation email before you deploy. The Worker forwards only after it has saved the email to R2, and only emails that passed every check.

## Change how long emails are kept

A lifecycle rule on the bucket deletes emails a set number of days after they arrive. The setup script creates one called `expire-30d`. To see the rules on your bucket, run:

```bash
npx wrangler r2 bucket lifecycle list r2-mailbox
```

To keep emails for a different number of days, add a new rule, then remove the old one. If you leave both in place, the shorter one wins:

```bash
npx wrangler r2 bucket lifecycle add r2-mailbox expire-90d mail/ \
  --expire-days 90 --force
npx wrangler r2 bucket lifecycle remove r2-mailbox --name expire-30d
```

To keep emails forever, remove the rule and don’t add a new one. The rule’s `mail/` argument is the folder it applies to; if you change `PREFIX`, use the new folder name here.

The setup script swallows errors from this step, so check with `lifecycle list` after the first setup that the rule exists.

## Change the folder emails are stored in

`PREFIX` sets the top folder for emails in the bucket. The default is `mail`. To store new emails in a different folder, set it to another name:

```jsonc
"PREFIX": "newsletters",
```

When you change it, you also need to:

- Set `prefix` in the reader’s `config.json` to the same value, or `R2_PREFIX` if you use environment variables
- Add a lifecycle rule for the new folder, as shown in [Change how long emails are kept](#change-how-long-emails-are-kept), because the setup script’s rule only covers `mail/`

Emails that arrived before the change stay in the old folder. The reader only looks in the folder set in its config.

## Use a bucket with a different name

The bucket name has to match in three places: the bucket itself, the Worker config, and the reader config. To use a name other than `r2-mailbox`:

1. Change `bucket_name` in `worker/wrangler.jsonc`.
2. Run `BUCKET=your_bucket_name ./scripts/setup.sh` to create the bucket, add the lifecycle rule, and deploy.
3. Set `bucket` in the reader’s `config.json` to the same name.
4. Create the read-only key for the new bucket, not the old one.

The setup script stops with an error if `BUCKET` doesn’t match `bucket_name` in `worker/wrangler.jsonc`.

## Rotate the read key

Replace the read key whenever you think it may have leaked, or on a regular schedule. The old key keeps working until you delete it, so you can switch without downtime:

1. Create a new token under **R2** > **Manage API tokens**, with **Object Read only** on the `r2-mailbox` bucket only.
2. Put the new Access Key ID and Secret Access Key in `~/.config/r2-mailbox/config.json`.
3. Run `python3 reader/mailbox.py check` to confirm the new key works.
4. Delete the old token in the dashboard.

## Delete emails

The read key can’t delete anything, so use Wrangler, which uses your Cloudflare login. To delete one email, pass the bucket name and the email’s key:

```bash
npx wrangler r2 object delete \
  r2-mailbox/mail/2026-11-17/your_email_key_here.eml --remote
```

Without `--remote`, Wrangler looks for the object in local development storage instead of your real bucket. To delete a large number of emails at once, change the lifecycle rule to a shorter period. R2 removes expired objects within 24 hours of expiring, not instantly.

## Stop receiving email

To stop storing new mail while you keep what’s already in the bucket, turn off or delete the routing rule under **Email Routing** > **Routing rules**. Email Routing then rejects mail to that address, unless a catch-all rule sends it somewhere else, and the Worker never runs.

To remove r2-mailbox completely, also delete the Worker under **Workers & Pages**, the bucket under **R2**, and the read-only token. R2 only lets you delete an empty bucket, so delete its emails first.

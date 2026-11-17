# Fix setup and delivery problems

This page covers the problems people hit when setting up r2-mailbox or waiting for an email that doesn’t show up. Each section starts with what you see, then explains the likely cause and the fix.

## Find out what happened to an email

Three places show what happened to an email, and they answer different questions:

- **Email Routing activity log**: under your domain’s **Email Routing** > **Activity**. It lists every email Cloudflare received for the domain and which rule handled it, including emails dropped before the Worker ran. Check this first.
- **Live Worker logs**: run `npm run tail`, or open the Worker’s **Logs** > **Live** tab in the dashboard. They show emails that arrive while they’re open, with any error the Worker hit.
- **Saved Worker logs**: under the Worker’s **Observability** tab. They keep past runs, and new entries can take a minute or two to appear.

If you have more than one Worker, make sure you’re looking at `r2-mailbox`.

## Nothing shows up after a test email

When `list` shows nothing after a test email, the email either never reached the Worker or the Worker rejected it. Work through these checks in order:

1. Wait a minute, then run `python3 reader/mailbox.py list --hours 1` again. Delivery can take a few seconds or more.
2. Open the Email Routing activity log. If your email isn’t there, it never reached Cloudflare; check that you sent it to the right address and that the domain’s MX records point to Cloudflare.
3. If the log shows the email but no Worker, check that a routing rule exists for the exact address, that it’s turned on, and that its action is **Send to a Worker** with `r2-mailbox`.
4. If the log shows the Worker rejected the email, check `ALLOWED_SENDERS` and `REQUIRE_DMARC` in `worker/wrangler.jsonc`.
5. Run `npm run tail`, send the test email again, and read the error if there is one.

If the email reached the bucket but `list` still doesn’t show it, check that `prefix` in the reader config matches `PREFIX` in `worker/wrangler.jsonc`.

## Email from one sender never arrives

When email from every other sender arrives but one sender’s never does, a check is rejecting that sender. There are three possible causes:

- **Email Routing’s DMARC check**: Email Routing drops email that fails DMARC when the sender’s domain asks for that with a `reject` or `quarantine` policy. This happens before the Worker runs, so the Worker logs show nothing. The activity log shows the drop.
- **`ALLOWED_SENDERS`**: the Worker checks the envelope sender, which can differ from the `From` line. See [Accept email only from senders you expect](managing-your-inbox.md#accept-email-only-from-senders-you-expect) for how to find the envelope address.
- **`REQUIRE_DMARC`**: with it on, the Worker rejects senders whose domain has no DMARC policy, as well as ones that fail.

## The Worker rejects a large email

The Worker rejects emails over 20 MiB with the reason `Message too large`. Email Routing rejects anything over 25 MiB before the Worker runs. Neither limit can be raised from r2-mailbox. Ask the sender for a link instead of an attachment.

## The reader says “R2 returned 403”

A 403 error means R2 refused the key. The key is wrong, deleted, or not allowed to read this bucket. Check these, in order:

1. `access_key_id` is the 32-character Access Key ID, not the token value that starts with `cf`.
2. `secret_access_key` is the 64-character Secret Access Key, copied in full.
3. `account_id` is your account ID, not a zone ID.
4. The token in **R2** > **Manage API tokens** still exists and includes this bucket.

If the key is lost or you’re not sure it’s right, create a new one. The steps are in [Rotate the read key](managing-your-inbox.md#rotate-the-read-key).

## The reader says “no config” or “config is missing”

The reader couldn’t find settings, or found a file with empty values. `no config` means there’s no `--config` flag, no `R2_ACCESS_KEY_ID` variable, and no `~/.config/r2-mailbox/config.json`. Create the file as shown in [Step 5 of the tutorial](getting-started.md#step-5-create-a-read-only-key).

`config is missing:` lists the empty fields. When you use environment variables, a common cause is a missing `R2_BUCKET`: the reader doesn’t fill in a default bucket name from the environment.

## Wrangler asks which account to use

Wrangler stops and asks for an account when your login has more than one. Set `account_id` in `worker/wrangler.jsonc`, or export `CLOUDFLARE_ACCOUNT_ID`, then run the command again. `npx wrangler whoami` lists your accounts and their IDs.

## The setup script says the bucket name doesn’t match

The script stops with `worker/wrangler.jsonc does not use bucket_name` when the `BUCKET` you passed doesn’t match the Worker config. Change `bucket_name` in `worker/wrangler.jsonc` to the same name, then run the script again.

## The setup script says Email Routing isn’t enabled

When you pass `ADDRESS`, `ZONE_ID`, and `CLOUDFLARE_API_TOKEN`, the script checks Email Routing before it creates a rule. The message `Email Routing is not enabled on this zone` has two causes:

- Email Routing isn’t turned on for the domain. Turn it on as shown in [Step 2 of the tutorial](getting-started.md#step-2-turn-on-email-routing), then run the script again.
- The message ends with `got: unknown`, which means the API call failed. Check that `ZONE_ID` is the right zone and that the token has **Email Routing Rules: Edit** on it.

## Your normal email stopped after turning on Email Routing

Email Routing replaced your domain’s MX records with Cloudflare’s, so your old provider stopped getting mail. To fix it:

1. Turn off Email Routing for the main domain.
2. Put your old provider’s MX records back in your DNS settings.
3. Set up r2-mailbox on a subdomain, such as `mail.yourdomain.com`, as described in [Choose a domain that won’t break your existing email](getting-started.md#choose-a-domain-that-wont-break-your-existing-email).

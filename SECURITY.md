# Security

r2-mailbox handles email, so security problems matter here. Thanks for taking the time to report one.

## Reporting a problem

Please do not open a public issue for a security problem.

Report it privately through GitHub instead: go to the Security tab of this repo and click "Report a vulnerability". Only I can see the report.

It helps if you include:

- what the problem is and what someone could do with it
- the steps to reproduce it
- the commit or version you tested

I will reply within a week. If the problem is real, I will fix it, credit you in the fix unless you would rather stay anonymous, and publish an advisory once the fix is out.

## What is supported

Only the latest commit on `main` gets fixes. There are no older release branches.

## What counts

Things I want to hear about:

- any way to reach the Worker other than through Email Routing
- any way to make the Worker write somewhere it should not, or skip the size, sender, or DMARC checks
- any way for an email to fake a DMARC pass when `REQUIRE_DMARC` is on
- anything in the reader that could leak credentials or run code from an email
- setup steps in the README that leave people with weaker settings than described

Things that are not bugs in this project:

- problems in Cloudflare's own services. Report those to Cloudflare.
- someone sending unwanted email to your address. Anyone who knows the address can send to it. Use `ALLOWED_SENDERS` to limit who gets through.
- an AI agent being tricked by text inside an email. The README says to treat email content as untrusted. If the reader itself does something unsafe with that content, that does count.

## How the design limits damage

- The Worker has no web URL and no fetch handler. Only Email Routing can invoke it.
- The Worker has no secrets. It writes to R2 through a binding.
- The reader uses an R2 key that can only read one bucket. A leaked key exposes the emails in that bucket and nothing else.
- The Worker stores emails without parsing them, so a malformed email cannot break parsing code inside the Worker.
- The reader never opens links or runs anything from an email. It only reads and parses.

## Keeping your setup safe

- Create the read key with "Object Read only" on this one bucket, nothing wider.
- Keep `config.json` private (`chmod 600`) and out of git. The repo's `.gitignore` already ignores `config.json`.
- Rotate the read key if you think it leaked: create a new R2 token, update `config.json`, then delete the old token.
- Keep the delete-after-N-days rule on the bucket unless you really need to keep old email.
- Set `ALLOWED_SENDERS` and `REQUIRE_DMARC` if you only expect mail from known senders.

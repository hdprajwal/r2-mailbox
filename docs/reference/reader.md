# Reader commands, config, and export format

This page lists every command and flag of `reader/mailbox.py`, where it reads its settings from, and every field in its JSON export. For task-based instructions, see [Read your mail from the command line](../reading-mail.md).

## Usage

The reader takes one global flag, then a command:

```text
python3 reader/mailbox.py [--config PATH] COMMAND [OPTIONS]
```

| Global flag | Description |
|---|---|
| `--config PATH` | Read settings from this JSON file. Must come before the command. |

The reader talks to R2 over its S3-compatible API, using only `GET` requests signed with AWS Signature Version 4. It never writes to the bucket and never opens a link from an email. Each request has a 30s timeout.

## Commands

The reader has five commands:

| Command | Description |
|---|---|
| `list` | Print one line per email in a time window |
| `show KEY` | Print one email’s headers, text, and links |
| `get KEY` | Download one email exactly as stored |
| `export` | Write the emails in a time window as parsed JSON |
| `check` | Confirm the reader can list the bucket |

### `list`

Prints one line per email that arrived in the window, oldest first.

| Option | Default | Description |
|---|---|---|
| `--hours N` | `24` | Window length in hours. Accepts decimals. |

Each line has four parts, separated by two spaces:

- The arrival time, from the `received` metadata
- The `From` header, padded or cut to 50 characters
- The subject, cut to 70 characters
- The key, in square brackets

`list` downloads each email in the window to read its metadata.

### `show`

Prints the `From`, `To`, `Date`, `Subject`, and `DMARC` lines, a blank line, and the parsed text. If the email has links, a `Links:` section follows, one link per line as `text -> url`, with the text cut to 60 characters.

| Argument | Description |
|---|---|
| `KEY` | The email’s full key, such as `mail/2026-11-17/….eml` |

### `get`

Downloads one email’s raw bytes.

| Argument or option | Default | Description |
|---|---|---|
| `KEY` | Required | The email’s full key |
| `-o`, `--out FILE` | Standard output | Write the email to this file |

### `export`

Writes every email in the window as one JSON document. See [Export format](#export-format).

| Option | Default | Description |
|---|---|---|
| `--hours N` | `24` | Window length in hours. Accepts decimals. |
| `-o`, `--out FILE` | Standard output | Write the JSON to this file and print `N message(s) -> FILE` to standard error |
| `--max-text N` | `20000` | Cut each email’s `text` to N characters. `0` keeps it whole. |

### `check`

Lists every key under the prefix and prints `ok: can list bucket 'BUCKET', N message(s) under PREFIX/`. Takes no options.

## How the time window works

`list` and `export` select emails by the arrival time in their key, which is in UTC. The reader lists each day folder from the start of the window through today, then keeps the keys whose time is inside the window. Each day folder costs one R2 list request per 1,000 emails.

## Where the reader looks for settings

The reader uses the first of these that applies:

1. The file passed with `--config`
2. Environment variables, if `R2_ACCESS_KEY_ID` is set
3. `~/.config/r2-mailbox/config.json`

It doesn’t mix sources. If it finds none, it exits with `no config: …`. If the source it picked has an empty required value, it exits with `config is missing:` and the names of the empty fields.

### Config file fields

The config file is a JSON object with these fields:

| Field | Required | Default | Description |
|---|---|---|---|
| `account_id` | Yes | None | Your Cloudflare account ID |
| `bucket` | Yes | None | The R2 bucket name, `r2-mailbox` unless you changed it |
| `access_key_id` | Yes | None | The 32-character R2 Access Key ID |
| `secret_access_key` | Yes | None | The 64-character R2 Secret Access Key |
| `prefix` | No | `mail` | The folder the Worker stores emails in; must match `PREFIX` |

### Environment variables

Each environment variable maps to one config field:

| Variable | Config field | Default |
|---|---|---|
| `R2_ACCOUNT_ID` | `account_id` | None |
| `R2_BUCKET` | `bucket` | None |
| `R2_ACCESS_KEY_ID` | `access_key_id` | None |
| `R2_SECRET_ACCESS_KEY` | `secret_access_key` | None |
| `R2_PREFIX` | `prefix` | `mail` |

## Export format

`export` writes one JSON object with four top-level fields:

| Field | Type | Description |
|---|---|---|
| `exported_at` | String | When the export ran, in ISO 8601 format with a UTC offset |
| `hours` | Number | The `--hours` value used |
| `count` | Number | The number of emails in `messages` |
| `messages` | Array | One object per email, oldest first |

Here’s an export with one email:

```json
{
  "exported_at": "2026-11-17T08:00:00+00:00",
  "hours": 24,
  "count": 1,
  "messages": [
    {
      "key": "mail/2026-11-17/2026-11-17T06:58:12.000Z-1b9d….eml",
      "received": "2026-11-17T06:58:12.000Z",
      "date": "2026-11-17T06:58:10+00:00",
      "from": "Dev Weekly <hi@devweekly.example>",
      "to": "inbox@yourdomain.com",
      "subject": "Issue 212: queues, caches, and you",
      "message_id": "<…>",
      "list_id": "",
      "dmarc": "pass",
      "attachments": [],
      "links": [{ "url": "https://…", "text": "Read online" }],
      "text": "This week: three ways to …"
    }
  ]
}
```

### Message fields

Each object in `messages` has these fields:

| Field | Type | Description |
|---|---|---|
| `key` | String | The email’s key in the bucket. Unique and never reused. |
| `received` | String | When the Worker stored the email, in ISO 8601 UTC |
| `date` | String | The email’s `Date` header in ISO 8601, or `received` if the header is missing or invalid |
| `from` | String | The `From` header |
| `to` | String | The `To` header |
| `subject` | String | The `Subject` header |
| `message_id` | String | The `Message-ID` header |
| `list_id` | String | The `List-Id` header, set by mailing lists and newsletters. Empty if absent. |
| `dmarc` | String | The DMARC result Cloudflare recorded. See [DMARC values](#dmarc-values). |
| `attachments` | Array of strings | The file names of attachments. Contents aren’t exported; use `get`. |
| `links` | Array of objects | Each link’s `url` and the `text` it was attached to, cut to 200 characters |
| `text` | String | The readable text of the email |
| `text_truncated` | Boolean | Present and `true` only when `text` was cut by `--max-text` |

All header fields are empty strings when the header is missing.

### How `text` and `links` are built

The reader builds `text` from one of the email’s two possible versions:

- If the email has an HTML version, the reader extracts its text, skipping `<head>`, `<style>`, and `<script>`, and starts a new line at block elements such as `<p>`, `<div>`, and `<br>`.
- If the email has a plain text version, the reader uses it instead when the HTML text is empty, or when the plain text is longer than 60% of the HTML text.

Runs of spaces and tabs become one space, and runs of blank lines become one blank line.

`links` comes from the `<a href>` tags in the HTML version. If there are none, the reader collects the `http` and `https` URLs in `text` instead, with an empty `text` for each. Only `http` and `https` links are kept, and each URL appears once.

### DMARC values

The `dmarc` field holds the result from the `Authentication-Results` header that Cloudflare adds when it receives the email:

| Value | Meaning |
|---|---|
| `pass` | The email came from the domain in its `From` address |
| `fail` | The email claims a domain that didn’t send it |
| `none` | The sender’s domain has no DMARC policy, or Cloudflare’s header had no DMARC result |
| `unknown` | The email had no `Authentication-Results` header from Cloudflare |

Other values, such as `temperror` or `permerror`, mean the check couldn’t finish. The Worker ignores `Authentication-Results` headers added by anyone other than Cloudflare.

## Exit codes and errors

The reader exits with `0` on success, and with `2` after printing its usage when a command or flag is wrong. On any other error, it prints a message to standard error and exits with `1`:

| Message | Cause |
|---|---|
| `no config: …` | No settings source found |
| `config is missing: …` | Required fields are empty |
| `R2 returned CODE for PATH: …` | R2 rejected a request; `403` means the key can’t read the bucket, `404` means no email has that key |

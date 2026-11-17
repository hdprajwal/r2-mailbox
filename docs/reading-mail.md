# Read your mail from the command line

The reader, `reader/mailbox.py`, lists, shows, downloads, and exports the emails in your bucket. This page shows how to do each of those, and how to read the bucket with other S3 tools instead. It assumes you’ve [set up your inbox](getting-started.md) and `python3 reader/mailbox.py check` succeeds.

Run every command from the repo folder. For every flag and output field, see the [reader reference](reference/reader.md).

## List recent emails

`list` prints one line per email that arrived in the last 24 hours:

```bash
python3 reader/mailbox.py list
```

Each line shows the time the email arrived, the sender, the subject, and the email’s key in square brackets. You pass the key to `show` and `get`.

To look further back, or at a shorter window, pass `--hours`. It accepts decimals:

```bash
python3 reader/mailbox.py list --hours 168   # the last 7 days
python3 reader/mailbox.py list --hours 0.5   # the last 30 minutes
```

`list` downloads each email to read its sender and subject, so a long window over a busy inbox takes a while. For a large number of emails, `export` gives you the same emails in one file.

## Read one email

`show` prints an email’s headers, its text, and its links:

```bash
python3 reader/mailbox.py show mail/2026-11-17/your_email_key_here.eml
```

The output starts with `From`, `To`, `Date`, `Subject`, and `DMARC`, followed by the text of the email. If the email only has an HTML version, the reader pulls the text out of the HTML. The links come last, each with the text it was attached to.

`show` never opens a link. Before you open one yourself, check that the email came from the sender you expect; the `DMARC` line helps with that. See [Check whether an email is genuine](#check-whether-an-email-is-genuine).

## Download the original email

`get` downloads the email exactly as it arrived, as an `.eml` file:

```bash
python3 reader/mailbox.py get \
  mail/2026-11-17/your_email_key_here.eml -o email.eml
```

You can open `email.eml` in most email apps, or parse it with any email library. Use `get` when you need an attachment, because `show` and `export` only list attachment file names. Without `-o`, `get` writes the email to standard output, so you can pipe it into another command.

## Export emails as JSON

`export` writes every email from a time window to one JSON file, already parsed:

```bash
python3 reader/mailbox.py export --hours 24 -o mail.json
```

The file has a `messages` list with one entry per email. Each entry has the sender, subject, date, DMARC result, links, attachment names, and text. The command prints how many emails it wrote. Without `-o`, `export` prints the JSON to standard output.

Each email’s text is cut at 20,000 characters, and a cut entry gets `"text_truncated": true`. To keep the full text, pass `--max-text 0`. To cut it shorter, pass a smaller number:

```bash
python3 reader/mailbox.py export --hours 24 --max-text 4000 -o mail.json
```

For the full list of fields, see [Export format](reference/reader.md#export-format). To run `export` on a schedule and pass the file to your own code, see [Send your mail to a script or AI agent](agents-and-scripts.md).

## Check whether an email is genuine

Anyone can put any address in an email’s `From` line, so check the DMARC result before you trust an email. Cloudflare records it when the email arrives, and `show` prints it on the `DMARC` line:

- **`pass`**: the email came from the domain in its `From` address
- **`fail`**: the email claims to be from a domain that didn’t send it
- **`none`**: the sender’s domain doesn’t publish a DMARC policy, so there was nothing to check
- **`unknown`**: Cloudflare’s check result wasn’t in the email

The Worker reads this only from the header that Cloudflare adds, so a sender can’t fake a `pass` by adding their own copy of the header. To reject everything that doesn’t pass, see [Require a DMARC pass](managing-your-inbox.md#require-a-dmarc-pass).

## Use a config file other than the default

The reader looks for its settings in `~/.config/r2-mailbox/config.json` by default. You can point it at another file, or use environment variables instead.

To use another file, pass `--config` before the command:

```bash
python3 reader/mailbox.py --config ./work-inbox.json list
```

To use environment variables, set all four of these:

```bash
export R2_ACCOUNT_ID=your_account_id_here
export R2_BUCKET=r2-mailbox
export R2_ACCESS_KEY_ID=your_access_key_id_here
export R2_SECRET_ACCESS_KEY=your_secret_access_key_here
python3 reader/mailbox.py check
```

The reader uses environment variables whenever `R2_ACCESS_KEY_ID` is set and you didn’t pass `--config`. In that case it ignores the config file completely, so set `R2_BUCKET` too. For the full order, see [Where the reader looks for settings](reference/reader.md#where-the-reader-looks-for-settings).

## Read the bucket with another S3 tool

R2 works with tools built for Amazon S3, so you can skip the reader and use any of them with the same read-only key. Point the tool at your account’s R2 endpoint and use `auto` as the region.

With the AWS command-line tool, for example, put the key in a profile first:

```bash
aws configure --profile r2-mailbox
```

Enter the Access Key ID and Secret Access Key when it asks, and `auto` for the region. Then list and download emails:

```bash
ENDPOINT=https://your_account_id_here.r2.cloudflarestorage.com

aws s3 ls s3://r2-mailbox/mail/ --recursive \
  --profile r2-mailbox --endpoint-url "$ENDPOINT"

aws s3 cp s3://r2-mailbox/mail/2026-11-17/your_email_key_here.eml . \
  --profile r2-mailbox --endpoint-url "$ENDPOINT"
```

To see the metadata the Worker attached to an email, such as the sender’s envelope address, use `head-object`:

```bash
aws s3api head-object --bucket r2-mailbox \
  --key mail/2026-11-17/your_email_key_here.eml \
  --profile r2-mailbox --endpoint-url "$ENDPOINT"
```

The metadata shows up under `Metadata` in the output. For the key layout and every metadata field, see the [Worker reference](reference/worker.md#storage-format).

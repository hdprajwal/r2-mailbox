# Change and deploy the code

r2-mailbox is two small programs: the Worker in `worker/src/index.ts`, and the reader in `reader/mailbox.py`. This page shows how to check, deploy, and debug changes to either one.

## Install the tools

`npm install` installs the pinned versions of Wrangler, TypeScript, and the Cloudflare type definitions that the npm scripts use:

```bash
npm install
```

The reader needs no install step. It uses only the Python standard library and runs on Python 3.9 or newer.

## Check and deploy the Worker

The npm scripts cover the Worker’s whole loop, from type-checking to watching it run:

```bash
npm run typecheck    # type-check the Worker against Cloudflare's types
npm run deploy       # deploy the Worker
npm run tail         # watch the Worker's logs live
```

There’s no local way to send an email to the Worker, so test a change by deploying it and sending a real email. Keep `npm run tail` open in a second terminal while you send it, to see the Worker run and any error it throws.

If you change the Worker’s settings or bindings, edit `worker/wrangler.jsonc` and deploy again. Keep `workers_dev` and `preview_urls` set to `false`, and don’t add a `fetch` handler or `routes`. Those keep the Worker unreachable from the internet; see [Why nobody can call the Worker from the internet](how-it-works.md#why-nobody-can-call-the-worker-from-the-internet).

## Run the reader against your bucket

The reader runs straight from the repo, so a change takes effect the next time you run it. Use `check` to confirm it can still reach R2, then `show` or `export` on a real email to test parsing:

```bash
python3 -I reader/mailbox.py check
python3 -I reader/mailbox.py show mail/2026-11-17/your_email_key_here.eml
```

The `-I` flag runs Python in isolated mode, so it ignores environment variables like `PYTHONPATH` and doesn’t load modules from the current folder. `npm run check` uses it too.

To test the parser without touching R2, download an email once with `get -o email.eml`, then run the reader’s `parse` function on the file. Save this as `parse_test.py` in the repo folder:

```python
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "r2_reader", "reader/mailbox.py"
)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

parsed = reader.parse(Path("email.eml").read_bytes())
print(json.dumps(parsed, indent=2, ensure_ascii=False))
```

`python3 -I parse_test.py` prints the email with the same fields as an `export` entry. `key` is empty and `received` and `dmarc` are `null`, because those come from R2, not the file. The script loads the reader by file path under the name `r2_reader`, because `import mailbox` would load the Python standard library module with the same name.

## Find your way around the repo

Each file has one job:

| File | What it does |
|---|---|
| `worker/src/index.ts` | The Email Worker: checks each email and saves it to R2 |
| `worker/wrangler.jsonc` | Worker config: the bucket binding and settings |
| `reader/mailbox.py` | The command-line reader, using the Python standard library only |
| `scripts/setup.sh` | Creates the bucket and lifecycle rule, deploys, and can add the routing rule |
| `config.example.json` | A template for the reader’s config file |
| `package.json` | Pinned Wrangler and TypeScript versions, plus the npm scripts |
| `tsconfig.json` | TypeScript settings for the Worker |
| `SECURITY.md` | How to report a security problem |
| `docs/` | These docs, as Markdown that GitHub and the docs site both render |
| `docs/images/` | Diagram PNGs for GitHub, rendered from the docs site’s diagram specs |
| `site/` | The docs site, built with Astro. See `site/README.md`. |

## Change a diagram

The diagrams in these docs are specs in `site/src/lib/diagrams/specs.mjs`. The docs site draws them live, and GitHub shows PNGs rendered from the same specs. After you change a spec, render the PNGs again from the `site/` folder:

```bash
npm install
npm run diagrams
```

The script writes a light and a dark PNG for each diagram to `docs/images/`. Commit them with the spec change, so GitHub and the site show the same diagram.

## Report a security problem

If a change you’re testing shows a way around the Worker’s checks, or a way to make the reader leak credentials, report it privately instead of opening a public issue. [SECURITY.md](../SECURITY.md) explains how, and lists what counts.

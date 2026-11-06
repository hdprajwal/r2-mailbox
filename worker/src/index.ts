// r2-mailbox: Cloudflare Email Worker that stores every message it receives in R2.
//
// Email Routing invokes email() for each message sent to an address you route to this
// Worker. The raw MIME is written to R2 unparsed (parsing would eat into the free-plan
// CPU budget); read and parse it later with reader/mailbox.py or any S3 client.
//
// There is deliberately no fetch() handler and no public URL. Only Email Routing can
// invoke this Worker.
//
// Object layout:  <PREFIX>/<YYYY-MM-DD>/<ISO timestamp>-<uuid>.eml
// Custom metadata: received, envelopeFrom, envelopeTo, from, subject, messageId, dmarc
//
// Optional vars (wrangler.jsonc "vars"):
//   ALLOWED_SENDERS  comma-separated sender addresses or @domains; others are rejected
//   REQUIRE_DMARC    "true" to reject mail whose DMARC result is not "pass"
//   FORWARD_TO       a verified Email Routing destination that also gets a copy
//   PREFIX           key prefix, default "mail"

interface Env {
  MAILBOX: R2Bucket;
  ALLOWED_SENDERS?: string;
  REQUIRE_DMARC?: string;
  FORWARD_TO?: string;
  PREFIX?: string;
}

const MAX_BYTES = 20 * 1024 * 1024;

function clip(s: string | null | undefined, n = 400): string {
  return (s ?? "").replace(/[\r\n]+/g, " ").slice(0, n);
}

/**
 * DMARC result from the Authentication-Results header Cloudflare adds
 * (authserv-id mx.cloudflare.net). Headers from anyone else are ignored.
 */
function dmarcResult(headers: Headers): string {
  const ar = headers.get("authentication-results") ?? "";
  const first = ar.split(/,\s*(?=mx\.cloudflare\.net)/)[0];
  if (!first.trim().startsWith("mx.cloudflare.net")) return "unknown";
  return /dmarc=(\w+)/.exec(first)?.[1] ?? "none";
}

function senderAllowed(from: string, allowList: string | undefined): boolean {
  const entries = (allowList ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return true;
  const addr = from.toLowerCase();
  return entries.some((e) => (e.startsWith("@") ? addr.endsWith(e) : addr === e));
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    if (message.rawSize > MAX_BYTES) {
      message.setReject("Message too large");
      return;
    }
    if (!senderAllowed(message.from, env.ALLOWED_SENDERS)) {
      message.setReject("Sender not allowed");
      return;
    }
    const dmarc = dmarcResult(message.headers);
    if (env.REQUIRE_DMARC === "true" && dmarc !== "pass") {
      message.setReject("DMARC check failed");
      return;
    }

    const iso = new Date().toISOString();
    const prefix = (env.PREFIX || "mail").replace(/\/+$/, "");
    const key = `${prefix}/${iso.slice(0, 10)}/${iso}-${crypto.randomUUID()}.eml`;
    const raw = await new Response(message.raw).arrayBuffer();

    await env.MAILBOX.put(key, raw, {
      httpMetadata: { contentType: "message/rfc822" },
      customMetadata: {
        received: iso,
        envelopeFrom: clip(message.from, 200),
        envelopeTo: clip(message.to, 200),
        from: clip(message.headers.get("from"), 300),
        subject: clip(message.headers.get("subject"), 400),
        messageId: clip(message.headers.get("message-id"), 300),
        dmarc,
      },
    });

    if (env.FORWARD_TO) {
      await message.forward(env.FORWARD_TO);
    }
  },
} satisfies ExportedHandler<Env>;

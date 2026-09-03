/**
 * Dependency-free HTML helpers for the fetch script (spec §4.3).
 * Entities are decoded exactly once; text nodes are re-escaped on output.
 */

const NAMED_ENTITIES = new Map<string, string>([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"], ["nbsp", "\u00a0"],
  ["ndash", "–"], ["mdash", "—"], ["hellip", "…"], ["laquo", "«"], ["raquo", "»"],
  ["bdquo", "„"], ["ldquo", "“"], ["rdquo", "”"], ["lsquo", "‘"], ["rsquo", "’"],
  ["copy", "©"], ["reg", "®"], ["trade", "™"], ["euro", "€"], ["times", "×"],
  ["deg", "°"], ["middot", "·"],
]);

const COMMENT_RE = /<!--[\s\S]*?-->/g;
// A tag: "<", optional "/", a name, then attributes where quoted values may contain ">".
const TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const HREF_RE = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "hr"]);
const VOID_TAGS = new Set(["br", "hr"]);
const DASH_PARAGRAPH_RE = /^\s*[-–—][\s\-–—]*$/;

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole: string, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES.get(body.toLowerCase()) ?? whole;
  });
}

export function stripTags(html: string): string {
  const text = html.replace(COMMENT_RE, "").replace(TAG_RE, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

export function isBlankHtml(html: string): boolean {
  return stripTags(html) === "";
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

function openingTag(name: string, attrs: string): string {
  if (name !== "a") return `<${name}>`;
  const m = HREF_RE.exec(attrs);
  const href = m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "").trim() : "";
  const keepHref = /^https?:\/\//i.test(href);
  return keepHref
    ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`
    : `<a target="_blank" rel="noopener noreferrer">`;
}

function dropBlankParagraphs(html: string): string {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (whole: string, inner: string) => (isBlankHtml(inner) ? "" : whole));
}

export function sanitizeHtml(html: string): string {
  const src = html.replace(COMMENT_RE, "");
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const out: string[] = [];
  const open: string[] = [];
  let last = 0;

  const emitText = (raw: string): void => {
    if (raw === "") return;
    if (open.length === 0 && raw.trim() === "") {
      out.push("\n");
      return;
    }
    out.push(escapeText(decodeEntities(raw)));
  };

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(src)) !== null) {
    emitText(src.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const name = (m[2] ?? "").toLowerCase();
    const attrs = m[3] ?? "";
    if (!ALLOWED_TAGS.has(name)) continue;
    if (VOID_TAGS.has(name)) {
      if (!closing) out.push(`<${name}>`);
      continue;
    }
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      while (open.length > at) out.push(`</${open.pop() ?? ""}>`);
      continue;
    }
    out.push(openingTag(name, attrs));
    open.push(name);
  }
  emitText(src.slice(last));
  while (open.length > 0) out.push(`</${open.pop() ?? ""}>`);

  return dropBlankParagraphs(out.join("")).replace(/\n{2,}/g, "\n").trim();
}

export function bioHtml(html: string): string {
  return sanitizeHtml(html).replace(/<p>([\s\S]*?)<\/p>/g, (whole: string, inner: string) =>
    DASH_PARAGRAPH_RE.test(stripTags(inner)) ? "<hr>" : whole,
  );
}

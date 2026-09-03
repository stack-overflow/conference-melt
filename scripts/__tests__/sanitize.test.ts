// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bioHtml, decodeEntities, isBlankHtml, sanitizeHtml, stripTags } from "../lib/sanitize";

// Excerpts of speaker content from the 2026-09-03 WordPress snapshot (cyfrowe-prelegent, _embed).

// Speaker 46683 (Maciej Szamałek): a literal "<p> </p>" between two real paragraphs.
const SPEAKER_46683_EXCERPT =
  "<p><strong>KONSULTACJE</strong><br>Pochwal się swoimi odlotowymi fotografiami, skonsultuj technikę, dowiedz się jak ulepszyć swój warsztat i spędź dobrze czas, bujając w obłokach fotografii lotniczej na stoisku Sony!</p>\n\n\n\n<p> </p>\n\n\n\n<p></p>\n\n\n\n<p><strong>Piątek (04-09-2026)</strong></p>";

// Speaker 537 (Adrian Truchta): dash paragraph ending in a hyphen, a heading, a list, a blank paragraph.
const SPEAKER_537_TAIL =
  "<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;-</p>\n\n\n\n<p><strong>Piątek (04-09-2026)</strong></p>\n\n\n\n<ul class=\"wp-block-list\">\n<li><strong>14:00 – 15:00</strong> | <em>Mini&amp;max. Pokaz makro na stoisku</em> | DZIAŁANIE W STREFIE | Marka: OM System | Miejsce: Stoiska wystawców &#8211; poziom I (PLENUM)</li>\n</ul>\n\n\n\n<p></p>\n";
const SPEAKER_537_TAIL_SANITIZED =
  "<p>——————————-</p>\n<p><strong>Piątek (04-09-2026)</strong></p>\n<ul>\n<li><strong>14:00 – 15:00</strong> | <em>Mini&amp;max. Pokaz makro na stoisku</em> | DZIAŁANIE W STREFIE | Marka: OM System | Miejsce: Stoiska wystawców – poziom I (PLENUM)</li>\n</ul>";

// Speaker 46608 (Magdalena Kozłowicz): blank paragraph, then dashes ending in an en dash.
const SPEAKER_46608_DASHES = "<p></p>\n\n\n\n<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8211;</p>";
// Speaker 341 (Grzegorz Maciąg): dashes with a trailing <br>.
const SPEAKER_341_DASHES = "<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;-<br></p>";
// Speaker 46694 (Paweł Uchorczak): em dashes only.
const SPEAKER_46694_DASHES = "<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;</p>";

// Speaker 46702 (Tomasz ZIENIU Zienkiewicz): links with data attributes and &amp; inside a href.
const SPEAKER_46702_LINKS =
  "<p>Strona: <a href=\"http://zieniu.pl\" data-type=\"link\" data-id=\"zieniu.pl\" target=\"_blank\" rel=\"noreferrer noopener\">zieniu.pl</a><br>Kursy fotograficzne: <a href=\"https://www.cyfrowe.pl/fotografia/kursy-i-szkolenia?facets%5Bproducer%5D%5B%5D=ZIENIU&amp;price%5Bmin_price%5D=&amp;price%5Bmax_price%5D=&amp;name=\" data-type=\"link\" data-id=\"https://www.cyfrowe.pl/fotografia/kursy-i-szkolenia?facets%5Bproducer%5D%5B%5D=ZIENIU&amp;price%5Bmin_price%5D=&amp;price%5Bmax_price%5D=&amp;name=\" target=\"_blank\" rel=\"noreferrer noopener\">dostępne w cyfrowe.pl</a></p>";

// Speaker 46619 (Olek LEYDO FILM Leydo): a YouTube embed block followed by a blank paragraph.
const SPEAKER_46619_EMBED =
  "<figure class=\"wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio\"><div class=\"wp-block-embed__wrapper\">\n<iframe loading=\"lazy\" title=\"ADV   Leydo Film   Peak Design   Boliwia\" width=\"500\" height=\"281\" src=\"https://www.youtube.com/embed/vY2jeEnPpEg?feature=oembed\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>\n</div></figure>\n\n\n\n<p></p>\n";

// Speaker 46691 (Tomasz Tołłoczko): an empty <sup></sup> in the middle of a word.
const SPEAKER_46691_SUP = "<p>Studia z historii sztuki pozwol<sup></sup>iły Tomaszowi opisywać dzieła sztuki</p>";

describe("decodeEntities", () => {
  it("decodes the numeric entities used by WordPress", () => {
    expect(decodeEntities("&#8211;")).toBe("–");
    expect(decodeEntities("&#8212;")).toBe("—");
    expect(decodeEntities("&#8222;cytat&#8221;")).toBe("„cytat”");
    expect(decodeEntities("&#8230;")).toBe("…");
    expect(decodeEntities("&#8217;")).toBe("’");
    expect(decodeEntities("&#215;")).toBe("×");
    expect(decodeEntities("&#x2013;")).toBe("–");
  });

  it("decodes the named entities nbsp and amp", () => {
    expect(decodeEntities("a&nbsp;b")).toBe("a b");
    expect(decodeEntities("&amp;")).toBe("&");
    expect(decodeEntities("&lt;b&gt;")).toBe("<b>");
  });

  it("decodes a real event title (46549)", () => {
    expect(decodeEntities("Analog na czasie &#8211; tips&amp;tricks domowej ciemni")).toBe(
      "Analog na czasie – tips&tricks domowej ciemni",
    );
  });

  it("decodes exactly once", () => {
    expect(decodeEntities("&amp;#8211;")).toBe("&#8211;");
    expect(decodeEntities("&amp;amp;")).toBe("&amp;");
  });

  it("leaves unknown or malformed entities untouched", () => {
    expect(decodeEntities("&bogus; &#; &# 12; & co")).toBe("&bogus; &#; &# 12; & co");
  });
});

describe("stripTags", () => {
  it("replaces tags with a space, decodes and collapses whitespace", () => {
    expect(stripTags("fotografii<br>lotnictwa")).toBe("fotografii lotnictwa");
    expect(stripTags("<p>Mini&amp;max.&nbsp;Pokaz</p>")).toBe("Mini&max. Pokaz");
    expect(stripTags("  <p> a </p>\n<p>b</p> ")).toBe("a b");
  });

  it("keeps anchor text and drops WordPress block comments", () => {
    expect(stripTags('<!-- wp:paragraph --><p>17:00-19:00, Sony <a href="https://www.cyfrowe.pl/x.html">Zapisz się</a></p><!-- /wp:paragraph -->')).toBe(
      "17:00-19:00, Sony Zapisz się",
    );
  });

  it("tolerates a > inside a quoted attribute", () => {
    expect(stripTags('<a href="https://a.pl/?q=a>b" title="x">t</a>')).toBe("t");
  });
});

describe("isBlankHtml", () => {
  it("treats empty, whitespace, nbsp and <br>-only content as blank", () => {
    expect(isBlankHtml("")).toBe(true);
    expect(isBlankHtml("<p></p>")).toBe(true);
    expect(isBlankHtml("<p> </p>")).toBe(true);
    expect(isBlankHtml("&nbsp;")).toBe(true);
    expect(isBlankHtml("<br>")).toBe(true);
    expect(isBlankHtml("\n\n")).toBe(true);
  });

  it("treats text and dashes as content", () => {
    expect(isBlankHtml("<p>a</p>")).toBe(false);
    expect(isBlankHtml("<p>&#8212;</p>")).toBe(false);
  });
});

describe("sanitizeHtml allowlist", () => {
  it("keeps p, br, strong, b, em, i, ul, ol, li, a and hr without attributes", () => {
    expect(sanitizeHtml('<ol start="3" class="x"><li><b>x</b> <i>y</i></li></ol><hr/>')).toBe("<ol><li><b>x</b> <i>y</i></li></ol><hr>");
    expect(sanitizeHtml("<p>a<br/>b<br>c</p>")).toBe("<p>a<br>b<br>c</p>");
    expect(sanitizeHtml('<ul class="wp-block-list">\n<li><strong>a</strong> <em>b</em></li>\n</ul>')).toBe("<ul>\n<li><strong>a</strong> <em>b</em></li>\n</ul>");
  });

  it("removes other tags but keeps their text", () => {
    expect(sanitizeHtml(SPEAKER_46691_SUP)).toBe("<p>Studia z historii sztuki pozwoliły Tomaszowi opisywać dzieła sztuki</p>");
    expect(sanitizeHtml('<p><span style="color:red">a</span> <img src="x.jpg" onerror="e()"> b</p>')).toBe("<p>a  b</p>");
  });

  it("removes a YouTube embed block entirely", () => {
    expect(sanitizeHtml(SPEAKER_46619_EMBED)).toBe("");
  });

  it("removes WordPress block comments", () => {
    expect(sanitizeHtml('<!-- wp:paragraph -->\n<p class="x" style="color:red">Hej</p>\n<!-- /wp:paragraph -->')).toBe("<p>Hej</p>");
  });

  it("lowercases tag names", () => {
    expect(sanitizeHtml("<P><STRONG>a</STRONG></P>")).toBe("<p><strong>a</strong></p>");
  });
});

describe("sanitizeHtml anchors", () => {
  it("keeps http(s) hrefs, drops every other attribute and adds target and rel", () => {
    expect(sanitizeHtml(SPEAKER_46702_LINKS)).toBe(
      "<p>Strona: <a href=\"http://zieniu.pl\" target=\"_blank\" rel=\"noopener noreferrer\">zieniu.pl</a><br>Kursy fotograficzne: <a href=\"https://www.cyfrowe.pl/fotografia/kursy-i-szkolenia?facets%5Bproducer%5D%5B%5D=ZIENIU&amp;price%5Bmin_price%5D=&amp;price%5Bmax_price%5D=&amp;name=\" target=\"_blank\" rel=\"noopener noreferrer\">dostępne w cyfrowe.pl</a></p>",
    );
  });

  it("drops javascript:, relative and mailto: hrefs but keeps the anchor text", () => {
    expect(sanitizeHtml('<p><a href="javascript:alert(1)" onclick="x()">klik</a> <a href="/o-nas">tu</a> <a href=\'mailto:a@b.pl\'>mail</a></p>')).toBe(
      '<p><a target="_blank" rel="noopener noreferrer">klik</a> <a target="_blank" rel="noopener noreferrer">tu</a> <a target="_blank" rel="noopener noreferrer">mail</a></p>',
    );
  });

  it("escapes quotes and angle brackets inside a kept href", () => {
    expect(sanitizeHtml('<p><a href="https://a.pl/?q=a>b&x=\'1\'" title="x">t</a></p>')).toBe(
      "<p><a href=\"https://a.pl/?q=a&gt;b&amp;x='1'\" target=\"_blank\" rel=\"noopener noreferrer\">t</a></p>",
    );
  });
});

describe("sanitizeHtml text nodes", () => {
  it("decodes entities once and re-escapes <, > and &", () => {
    expect(sanitizeHtml("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2, a < b</p>")).toBe("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2, a &lt; b</p>");
    expect(sanitizeHtml("<p>&amp;#8211; zostaje literalnie</p>")).toBe("<p>&amp;#8211; zostaje literalnie</p>");
    expect(sanitizeHtml("<p>Mini&amp;max &#8211; „test&#8221;</p>")).toBe("<p>Mini&amp;max – „test”</p>");
  });

  it("closes unclosed tags and drops stray closing tags", () => {
    expect(sanitizeHtml("<p><strong>a</p><em>b")).toBe("<p><strong>a</strong></p><em>b</em>");
    expect(sanitizeHtml("<p>a</em> b</p>")).toBe("<p>a b</p>");
  });
});

describe("sanitizeHtml blank paragraphs", () => {
  it("removes the whitespace-only paragraph of speaker 46683 and the empty one after it", () => {
    expect(sanitizeHtml(SPEAKER_46683_EXCERPT)).toBe(
      "<p><strong>KONSULTACJE</strong><br>Pochwal się swoimi odlotowymi fotografiami, skonsultuj technikę, dowiedz się jak ulepszyć swój warsztat i spędź dobrze czas, bujając w obłokach fotografii lotniczej na stoisku Sony!</p>\n<p><strong>Piątek (04-09-2026)</strong></p>",
    );
  });

  it("removes empty, nbsp-only, br-only and whitespace-only paragraphs", () => {
    expect(sanitizeHtml("<p></p><p>&nbsp;</p><p><br></p><p> \n </p><p>x</p>")).toBe("<p>x</p>");
  });

  it("collapses the blank lines WordPress puts between blocks to one newline", () => {
    expect(sanitizeHtml("\n<p>a</p>\n\n\n\n<p>b</p>\n")).toBe("<p>a</p>\n<p>b</p>");
    expect(sanitizeHtml(SPEAKER_537_TAIL)).toBe(SPEAKER_537_TAIL_SANITIZED);
  });
});

describe("bioHtml", () => {
  it("replaces dash-only paragraphs with <hr>", () => {
    expect(bioHtml(SPEAKER_46694_DASHES)).toBe("<hr>");
    expect(bioHtml("<p>-</p>")).toBe("<hr>");
    expect(bioHtml("<p>- - -</p>")).toBe("<hr>");
    expect(bioHtml("<p>&#8211;&#8212;-</p>")).toBe("<hr>");
  });

  it("replaces a dash paragraph ending in an en dash (speaker 46608)", () => {
    expect(bioHtml(SPEAKER_46608_DASHES)).toBe("<hr>");
  });

  it("replaces a dash paragraph with a trailing <br> (speaker 341)", () => {
    expect(bioHtml(SPEAKER_341_DASHES)).toBe("<hr>");
  });

  it("keeps paragraphs that contain text next to dashes", () => {
    expect(bioHtml("<p>&#8212; uwaga</p>")).toBe("<p>— uwaga</p>");
    expect(bioHtml("<p>Tomasz &#8211; fotograf</p>")).toBe("<p>Tomasz – fotograf</p>");
  });

  it("removes blank paragraphs before applying the rule, so they never become <hr>", () => {
    expect(bioHtml("<p></p>")).toBe("");
    expect(bioHtml("<p> </p>\n<p>&nbsp;</p>")).toBe("");
  });

  it("sanitizes and separates the tail of speaker 537", () => {
    expect(bioHtml(SPEAKER_537_TAIL)).toBe("<hr>" + SPEAKER_537_TAIL_SANITIZED.slice("<p>——————————-</p>".length));
  });
});

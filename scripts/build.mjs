import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");

const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function frontmatter(source) {
  if (!source.startsWith("---\n")) return [{}, source.trim()];
  const end = source.indexOf("\n---\n", 4);
  if (end < 0) return [{}, source.trim()];

  const data = {};
  let activeList = null;
  for (const line of source.slice(4, end).split("\n")) {
    const item = line.match(/^\s*-\s+(.+)$/);
    if (item && activeList) {
      data[activeList].push(item[1].trim());
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, raw] = pair;
    data[key] = raw ? raw.replace(/^["']|["']$/g, "") : [];
    activeList = raw ? null : key;
  }

  return [data, source.slice(end + 5).trim()];
}

function inline(text) {
  const saved = [];
  const keep = (html) => {
    const token = `__AI_PLUS_INLINE_${saved.length}__`;
    saved.push(html);
    return token;
  };

  return esc(text)
    .replace(/`([^`]+)`/g, (_, code) => keep(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
      keep(`<a href="${href.replace(/\.md(?=($|#))/i, ".html")}">${label}</a>`),
    )
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, href, label) =>
      keep(`<a href="${encodeURI(href.trim())}.html">${label.trim()}</a>`),
    )
    .replace(/\[\[([^\]]+)\]\]/g, (_, href) =>
      keep(`<a href="${encodeURI(href.trim())}.html">${href.trim()}</a>`),
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__AI_PLUS_INLINE_(\d+)__/g, (_, index) => saved[Number(index)]);
}

function markdown(source) {
  const out = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };

  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const next = unordered ? "ul" : "ol";
      if (list !== next) {
        closeList();
        list = next;
        out.push(`<${list}>`);
      }
      out.push(`<li>${inline((unordered || ordered)[1])}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return out.join("\n");
}

function page({ title, description, body, prefix = "" }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${esc(description || "AI、设计与创业知识站")}">
  <title>${esc(title)} · AI +1</title>
  <link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body>
  <header class="site-header shell">
    <a class="brand" href="${prefix}index.html">AI +1</a>
    <span class="tagline">AI · Design · Startup</span>
  </header>
  <main class="shell">${body}</main>
  <footer class="site-footer shell">Built from Obsidian · Updated by GitHub Actions</footer>
</body>
</html>`;
}

function filesByExtension(dir, extensions, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    const relative = path.posix.join(base, entry.name);
    if (entry.isDirectory()) return filesByExtension(absolute, extensions, relative);
    return entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))
      ? [{ absolute, relative }]
      : [];
  });
}

function htmlTitle(source, fallback) {
  const match = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : fallback;
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(path.join(publicDir, "assets"), { recursive: true });
fs.copyFileSync(path.join(root, "static", "style.css"), path.join(publicDir, "assets/style.css"));

const articles = [];
for (const file of filesByExtension(contentDir, [".md"])) {
  if (file.relative === "index.md") continue;
  const [meta, body] = frontmatter(fs.readFileSync(file.absolute, "utf8"));
  const title = meta.title || body.match(/^#\s+(.+)$/m)?.[1] || path.basename(file.relative, ".md");
  const href = file.relative.replace(/\.md$/i, ".html");
  const prefix = "../".repeat(href.split("/").length - 1);
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const tagHtml = tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("");

  fs.mkdirSync(path.dirname(path.join(publicDir, href)), { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, href),
    page({
      title,
      description: meta.description,
      prefix,
      body: `<article class="article">
        <a class="back" href="${prefix}index.html">← 返回首页</a>
        <p class="eyebrow">${esc(meta.date || "NOTE")}</p>
        <div class="content">${markdown(body)}</div>
        <div class="tags">${tagHtml}</div>
      </article>`,
    }),
  );
  articles.push({ title, href: encodeURI(href), date: meta.date || "", description: meta.description || "" });
}

for (const file of filesByExtension(contentDir, [".html", ".htm"])) {
  const source = fs.readFileSync(file.absolute, "utf8");
  const title = htmlTitle(source, path.basename(file.relative, path.extname(file.relative)));
  const target = path.join(publicDir, file.relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
  articles.push({
    title,
    href: encodeURI(file.relative),
    date: "",
    description: "自定义 HTML 页面",
  });
}

articles.sort((a, b) => String(b.date).localeCompare(String(a.date), "zh-CN"));
const [homeMeta, homeBody] = frontmatter(fs.readFileSync(path.join(contentDir, "index.md"), "utf8"));
const cards = articles
  .map(
    (article) => `<a class="card" href="${article.href}">
      <p class="meta">${esc(article.date || "文章")}</p>
      <h2>${esc(article.title)}</h2>
      <p>${esc(article.description || "阅读全文")}</p>
    </a>`,
  )
  .join("");

fs.writeFileSync(
  path.join(publicDir, "index.html"),
  page({
    title: homeMeta.title || "AI +1",
    description: homeMeta.description,
    body: `<section class="hero">
      <p class="eyebrow">Personal Knowledge Station</p>
      <div class="content">${markdown(homeBody)}</div>
      <p class="intro">${esc(homeMeta.description || "")}</p>
    </section>
    <h2 class="section-title">Latest Notes</h2>
    <section class="grid">${cards}</section>`,
  }),
);
fs.writeFileSync(path.join(publicDir, ".nojekyll"), "");
console.log(`Built ${articles.length + 1} pages into public/`);

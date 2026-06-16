import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const nl = String.fromCharCode(10);
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function frontmatter(source) {
  if (!source.startsWith("---" + nl)) return [{}, source.trim()];
  const end = source.indexOf(nl + "---" + nl, 4);
  if (end < 0) return [{}, source.trim()];
  const data = {};
  let listKey = null;
  for (const line of source.slice(4, end).split(nl)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") && listKey) {
      data[listKey].push(trimmed.slice(2));
      continue;
    }
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    data[key] = value || [];
    listKey = value ? null : key;
  }
  return [data, source.slice(end + 5).trim()];
}

function isOrdered(line) {
  const dot = line.indexOf(".");
  return dot > 0 && line.slice(0, dot).split("").every((char) => char >= "0" && char <= "9") && line[dot + 1] === " ";
}

function markdown(source) {
  const html = [];
  let paragraph = [];
  let list = null;
  const flush = () => {
    if (!paragraph.length) return;
    html.push(`<p>${esc(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  };
  for (const raw of source.split(nl)) {
    const line = raw.trim();
    if (!line) {
      flush();
      closeList();
      continue;
    }
    if (line.startsWith("#")) {
      flush();
      closeList();
      const level = line.split("").findIndex((char) => char !== "#");
      html.push(`<h${level}>${esc(line.slice(level).trim())}</h${level}>`);
      continue;
    }
    const unordered = line.startsWith("- ");
    const ordered = isOrdered(line);
    if (unordered || ordered) {
      flush();
      const next = unordered ? "ul" : "ol";
      if (list !== next) {
        closeList();
        list = next;
        html.push(`<${list}>`);
      }
      const item = unordered ? line.slice(2) : line.slice(line.indexOf(".") + 2);
      html.push(`<li>${esc(item)}</li>`);
      continue;
    }
    paragraph.push(line);
  }
  flush();
  closeList();
  return html.join(nl);
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

function files(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    const relative = path.posix.join(base, entry.name);
    if (entry.isDirectory()) return files(absolute, relative);
    return entry.isFile() && entry.name.endsWith(".md") ? [{ absolute, relative }] : [];
  });
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(path.join(publicDir, "assets"), { recursive: true });
fs.copyFileSync(path.join(root, "static", "style.css"), path.join(publicDir, "assets/style.css"));

const articles = [];
for (const file of files(contentDir)) {
  if (file.relative === "index.md") continue;
  const [meta, body] = frontmatter(fs.readFileSync(file.absolute, "utf8"));
  const title = meta.title || path.basename(file.relative, ".md");
  const href = file.relative.replace(/\.md$/i, ".html");
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  fs.writeFileSync(path.join(publicDir, href), page({
    title,
    description: meta.description,
    body: `<article class="article"><a class="back" href="index.html">← 返回首页</a><p class="eyebrow">${esc(meta.date || "NOTE")}</p><div class="content">${markdown(body)}</div><div class="tags">${tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div></article>`,
  }));
  articles.push({ title, href: encodeURI(href), date: meta.date || "", description: meta.description || "" });
}

articles.sort((a, b) => String(b.date).localeCompare(String(a.date), "zh-CN"));
const [homeMeta, homeBody] = frontmatter(fs.readFileSync(path.join(contentDir, "index.md"), "utf8"));
const cards = articles.map((article) => `<a class="card" href="${article.href}"><p class="meta">${esc(article.date || "文章")}</p><h2>${esc(article.title)}</h2><p>${esc(article.description || "阅读全文")}</p></a>`).join("");
fs.writeFileSync(path.join(publicDir, "index.html"), page({
  title: homeMeta.title || "AI +1",
  description: homeMeta.description,
  body: `<section class="hero"><p class="eyebrow">Personal Knowledge Station</p><div class="content">${markdown(homeBody)}</div><p class="intro">${esc(homeMeta.description || "")}</p></section><h2 class="section-title">Latest Notes</h2><section class="grid">${cards}</section>`,
}));
fs.writeFileSync(path.join(publicDir, ".nojekyll"), "");
console.log(`Built ${articles.length + 1} pages into public/`);

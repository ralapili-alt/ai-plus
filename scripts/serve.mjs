import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.join(process.cwd(), "public");
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const relative = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const candidate = path.resolve(root, relative);

  if (!candidate.startsWith(root) || !fs.existsSync(candidate)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const file = fs.statSync(candidate).isDirectory()
    ? path.join(candidate, "index.html")
    : candidate;
  response.writeHead(200, {
    "content-type": types[path.extname(file)] || "application/octet-stream",
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI +1 is running at http://127.0.0.1:${port}`);
});

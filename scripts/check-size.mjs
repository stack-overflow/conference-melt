import { statSync } from "node:fs";
import { resolve } from "node:path";

const LIMIT_BYTES = 1.5 * 1024 * 1024;
const file = resolve(process.cwd(), "dist/index.html");

let size;
try {
  size = statSync(file).size;
} catch {
  console.error(`check-size: ${file} not found. Run "npm run build" first.`);
  process.exit(1);
}

const kb = (size / 1024).toFixed(1);
if (size > LIMIT_BYTES) {
  console.error(`check-size: dist/index.html is ${kb} KB, over the 1.5 MB limit.`);
  process.exit(1);
}
console.log(`check-size: dist/index.html is ${kb} KB (limit 1536 KB). OK`);

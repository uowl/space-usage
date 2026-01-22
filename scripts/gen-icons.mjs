import fs from "node:fs";
import path from "node:path";

// 1x1 transparent PNG
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "..");
const iconDir = path.join(repoRoot, "src-tauri", "icons");
const iconPath = path.join(iconDir, "icon.png");

fs.mkdirSync(iconDir, { recursive: true });
fs.writeFileSync(iconPath, Buffer.from(PNG_1X1_BASE64, "base64"));

console.log(`Generated icon at ${iconPath}`);


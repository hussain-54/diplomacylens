const fs = require("fs");
const path = require("path");
const dir = path.join("src", "routes");
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".tsx")) continue;
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("INFO_PAGES")) continue;
  s = s.replace(
    /title:\s*`[^`]*Diplomacy Lens`/,
    'title: content.title + " — Diplomacy Lens"',
  );
  s = s.replace(
    /title:\s*'[^']*Diplomacy Lens'/,
    'title: content.title + " — Diplomacy Lens"',
  );
  fs.writeFileSync(p, s);
  console.log("fixed", f);
}

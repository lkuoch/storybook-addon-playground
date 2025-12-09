import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export function getFilteredLibs() {
  try {
    const tsLibPath = path.dirname(
      require.resolve("typescript/lib/lib.dom.d.ts")
    );
    const esNextFull = fs.readFileSync(
      path.join(tsLibPath, "lib.esnext.full.d.ts"),
      "utf-8"
    );
    let domLib = fs.readFileSync(path.join(tsLibPath, "lib.dom.d.ts"), "utf-8");

    const whitelist = new Set([
      // Keep only strictly necessary globals
      "console",
      "window",
      "document",
      "navigator",
      "location",
      "history",
      "localStorage",
      "sessionStorage",
      "screen",
      "alert",
      "confirm",
      "prompt",
      "fetch",
      "setTimeout",
      "setInterval",
      "clearTimeout",
      "clearInterval",
      "JSON",
      "Math",
      "Date", // These are usually in esnext but good to be safe if they appear in dom lib
    ]);

    domLib = domLib.replace(
      /declare var ([A-Z][a-zA-Z0-9]*):/g,
      (match, name) => {
        if (whitelist.has(name)) {
          return match;
        }
        return `declare var __${name}:`;
      }
    );

    const combinedLib = esNextFull + "\n" + domLib;
    return combinedLib;
  } catch (e) {
    console.error("Failed to load filtered libs", e);
    return "";
  }
}

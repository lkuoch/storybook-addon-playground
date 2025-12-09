import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { getFilteredLibs } from "./scripts/get-filtered-libs.js";

const require = createRequire(import.meta.url);
const exportEntry = "src/index.ts";
const managerEntry = "src/manager.ts";

export default {
  external: (id) => {
    // Externalize all node_modules, but be explicit about prettier
    if (id.includes("node_modules")) return true;
    // Explicitly externalize prettier and its parsers
    if (id === "prettier" || id.startsWith("prettier/")) return true;
    return false;
  },
  plugins: [
    {
      name: "virtual-playground-plugins",
      resolveId(id) {
        if (id === "virtual:react-types") {
          return "\0virtual:react-types";
        }
        if (id === "virtual:filtered-libs") {
          return "\0virtual:filtered-libs";
        }
      },
      load(id) {
        if (id === "\0virtual:react-types") {
          try {
            const reactTypesPath = path.resolve(
              process.cwd(),
              "node_modules/@types/react/index.d.ts"
            );
            const globalTypesPath = path.resolve(
              process.cwd(),
              "node_modules/@types/react/global.d.ts"
            );

            let content = "";
            if (fs.existsSync(reactTypesPath)) {
              content += fs.readFileSync(reactTypesPath, "utf-8");
            }
            if (fs.existsSync(globalTypesPath)) {
              content += "\n" + fs.readFileSync(globalTypesPath, "utf-8");
            }
            return `export const REACT_TYPES = ${JSON.stringify(content)};`;
          } catch (e) {
            console.error("Failed to load React types in rollup", e);
            return `export const REACT_TYPES = "";`;
          }
        }
        if (id === "\0virtual:filtered-libs") {
          const libs = getFilteredLibs();
          return `export const FILTERED_LIBS = ${JSON.stringify(libs)};`;
        }
      },
    },
    resolve(),
    commonjs(),
    json(),
    typescript({
      tsconfigOverride: {
        exclude: [
          "src/**/__tests__/**",
          "src/**/*.test.ts",
          "src/**/*.test.tsx",
        ],
      },
    }),
    postcss({
      modules: true,
      inject(cssVariableName) {
        return `import styleInject from 'style-inject';\nstyleInject(${cssVariableName});`;
      },
    }),
  ],
  input: [exportEntry, managerEntry],
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
    preserveModules: true,
  },
};

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "node:fs";
import path from "node:path";
import { getFilteredLibs } from "./scripts/get-filtered-libs.js";

function playgroundPlugins() {
  const reactTypesModuleId = "virtual:react-types";
  const resolvedReactTypesModuleId = "\0" + reactTypesModuleId;
  const filteredLibsModuleId = "virtual:filtered-libs";
  const resolvedFilteredLibsModuleId = "\0" + filteredLibsModuleId;

  return {
    name: "vite-plugin-playground",
    resolveId(id: string) {
      if (id === reactTypesModuleId) {
        return resolvedReactTypesModuleId;
      }
      if (id === filteredLibsModuleId) {
        return resolvedFilteredLibsModuleId;
      }
    },
    load(id: string) {
      if (id === resolvedReactTypesModuleId) {
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
          console.error("Failed to load React types", e);
          return `export const REACT_TYPES = "";`;
        }
      }

      if (id === resolvedFilteredLibsModuleId) {
        const libs = getFilteredLibs();
        return `export const FILTERED_LIBS = ${JSON.stringify(libs)};`;
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), playgroundPlugins()],
  build: {
    sourcemap: true,
  },
  assetsInclude: ["/sb-preview/runtime.js"],
});

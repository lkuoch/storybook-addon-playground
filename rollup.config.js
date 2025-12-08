import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";

const exportEntry = "src/index.ts";
const managerEntry = "src/manager.ts";

export default {
  external: (id) => {
    // Externalize all node_modules, but be explicit about prettier
    if (id.includes('node_modules')) return true;
    // Explicitly externalize prettier and its parsers
    if (id === 'prettier' || id.startsWith('prettier/')) return true;
    return false;
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript({
      tsconfigOverride: {
        exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/**/*.test.tsx"]
      }
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

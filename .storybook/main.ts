import type { StorybookConfig } from "@storybook/react-vite";
const config: StorybookConfig = {
  stories: ["./**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["storybook-addon-playground", "@storybook/addon-docs"],

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  features: {
    actions: false,
    controls: false,
    highlight: false,
    measure: false,
    outline: false,
    viewport: false
  }
};
export default config;

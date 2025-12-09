import type { StorybookConfig } from "@storybook/react-vite";
const config: StorybookConfig = {
  stories: ["./**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@spaceship-fspl/sb-addon-playground-monaco", "@storybook/addon-docs"],

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

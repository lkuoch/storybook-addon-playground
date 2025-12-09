import type { Preview } from "@storybook/react-vite";
import * as VibeComponents from "@vibe/core";
import * as VibeNext from "@vibe/core/next";
import * as VibeIcons from "@vibe/icons";
import reactDocgenOutput from "./react-docgen-output-example.json";
import { generateAutocompletion } from "../src";

const preview: Preview = {
  parameters: {
    playground: {
      storyId: "playground--playground",
      components: { ...VibeComponents, ...VibeNext, VibeIcons },
      autocompletions: generateAutocompletion(reactDocgenOutput),
      reactDocgenOutput: reactDocgenOutput, // Also pass the raw output for type definitions
      editorTheme: "light",
      introCode: {
        jsx: `<Heading>Online Playground</Heading>`,
        css: ""
      },
      share: true,
    },
  },
};

export default preview;

import { useParameter, useStorybookState } from "storybook/manager-api";
import { EditorTheme, PlaygroundParameters } from "@/types";
import { ADDON_ID_FOR_PARAMETERS, DEFAULT_ADDON_PARAMETERS } from "@/consts";

function isBasicTheme(theme: EditorTheme): theme is "light" | "dark" {
  return typeof theme === "string" && ["light", "dark"].includes(theme);
}

function getMonacoTheme(basicThemeName: string): string {
  return basicThemeName === "dark" ? "vs-dark" : "vs";
}

const useEditorTheme = (): EditorTheme => {
  const { theme: storybookTheme } = useStorybookState();
  const { editorTheme: addonTheme } = useParameter<PlaygroundParameters>(
    ADDON_ID_FOR_PARAMETERS,
    DEFAULT_ADDON_PARAMETERS
  );
  if (isBasicTheme(addonTheme)) {
    return getMonacoTheme(addonTheme);
  }
  // If custom theme string provided, use it; otherwise use storybook theme
  return addonTheme || getMonacoTheme(storybookTheme.base);
};

export default useEditorTheme;

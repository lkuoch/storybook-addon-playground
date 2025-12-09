import type { editor } from "monaco-editor";
import { KeyCode, KeyMod } from "monaco-editor";
import closingBracket from "./closing-bracket";
import selfClosingTag from "./self-closing-tag";
import stringUnionConversion from "./string-union-conversion";
import { AutocompletionsMetadata } from "@/types";

export function registerPlaygroundKeybindings(
  editorInstance: editor.IStandaloneCodeEditor,
  autocompletions?: AutocompletionsMetadata
): () => void {
  // For Monaco, we use onDidChangeModelContent to detect when '>' or '/' is typed
  // We need to be careful to only process single character insertions to avoid interfering with normal input
  const disposable = editorInstance.onDidChangeModelContent((e) => {
    if (e.changes.length === 0) return;

    const change = e.changes[0];

    // Only process single character insertions (not deletions, not multi-character changes)
    if (change.text.length !== 1 || change.rangeLength !== 0) {
      return;
    }

    const position = editorInstance.getPosition();
    const model = editorInstance.getModel();

    if (!position || !model) return;

    const typedChar = change.text;

    // Only handle '>' and '/' characters - ignore everything else including numbers
    if (typedChar !== ">" && typedChar !== "/") {
      return;
    }

    // Use a small timeout to allow the character to be inserted first
    setTimeout(() => {
      const currentPosition = editorInstance.getPosition();
      if (!currentPosition) return;

      const lineContent = model.getLineContent(currentPosition.lineNumber);
      const beforeCursor = lineContent.substring(0, currentPosition.column - 1);
      const afterCursor = lineContent.substring(currentPosition.column - 1);

      if (typedChar === ">") {
        // Try to trigger auto-closing
        const tagName = /<([a-zA-Z0-9]+)/.exec(beforeCursor)?.[1];
        if (
          tagName &&
          !beforeCursor.trim().endsWith("/") &&
          !afterCursor.startsWith(">")
        ) {
          closingBracket(editorInstance);
        }
      } else if (typedChar === "/") {
        selfClosingTag(editorInstance);
      }
    }, 0);
  });

  // Register Tab key handler to convert {} to "" for string union types
  let tabKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  let tabKeyDisposable: { dispose: () => void } | null = null;

  if (autocompletions) {
    const editorContainer = editorInstance.getContainerDomNode();
    tabKeyHandler = (event: KeyboardEvent) => {
      // Only handle Tab key when editor has focus
      if (!editorInstance.hasTextFocus() || event.key !== "Tab") {
        return;
      }

      // Check if we're in the right context (propName={})
      if (stringUnionConversion(editorInstance, autocompletions)) {
        // Conversion was successful, prevent default Tab behavior
        event.preventDefault();
        event.stopPropagation();
      }
      // Otherwise, let Tab work normally (indentation, etc.)
    };

    // Use capture phase to intercept before Monaco handles it
    editorContainer.addEventListener("keydown", tabKeyHandler, true);

    tabKeyDisposable = {
      dispose: () => {
        if (tabKeyHandler) {
          editorContainer.removeEventListener("keydown", tabKeyHandler, true);
        }
      },
    };
  }

  // Return cleanup function
  return () => {
    disposable.dispose();
    if (tabKeyDisposable) {
      tabKeyDisposable.dispose();
    }
  };
}

export { default as closingBracket } from "./closing-bracket";
export { default as selfClosingTag } from "./self-closing-tag";

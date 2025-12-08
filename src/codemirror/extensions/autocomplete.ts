import type { editor, IDisposable } from "monaco-editor";
import { languages } from "monaco-editor";
import { getEditorStateInfo } from "../utils/extensions-utils";
import { AutocompletionsMetadata } from "@/types";
import {
  getNewTagContext,
  shouldTriggerPropSuggestions,
  extractAlreadyUsedProps,
  isInsideAttribute,
} from "../utils/autocomplete-utils";

function generateComponentNameCompletions(
  partialName: string,
  options: AutocompletionsMetadata,
  range: languages.CompletionItem["range"]
): languages.CompletionItem[] {
  return Object.keys(options)
    .filter((componentName) =>
      componentName.toLowerCase().startsWith(partialName.toLowerCase())
    )
    .map((componentName) => ({
      label: componentName,
      kind: languages.CompletionItemKind.Keyword,
      insertText: `${componentName} `,
      insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      sortText: `0${componentName}`, // Sort components first
      detail: "Component",
    }));
}

function generatePropCompletions(
  componentName: keyof AutocompletionsMetadata,
  options: AutocompletionsMetadata,
  partialPropName: string,
  usedProps: Set<string>,
  range: languages.CompletionItem["range"]
): languages.CompletionItem[] {
  const componentProps = options[componentName];
  if (!componentProps?.length) {
    return [];
  }

  const normalizedProps = componentProps.flatMap((propItem) =>
    Object.entries(propItem).map(([name, propInfo]) => ({ name, ...propInfo }))
  );

  return normalizedProps
    .filter(
      ({ name }) => !usedProps.has(name) && name.startsWith(partialPropName)
    )
    .map(({ name, type, required, defaultValue, description }) => {
      const typeStr = Array.isArray(type) ? type.join(" | ") : type;
      const insertText =
        type === "string" ? `${name}="$1"` : `${name}={$1}`;
      const documentation =
        (description ? `${description}` : "") +
        (description && defaultValue ? " | " : "") +
        (defaultValue ? ` Defaults to: ${defaultValue}` : "");

      return {
        label: name,
        kind: required
          ? languages.CompletionItemKind.Property
          : languages.CompletionItemKind.Property,
        detail: typeStr,
        documentation: documentation || undefined,
        insertText,
        insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        sortText: required ? `0${name}` : `1${name}`, // Required props first
        tags: required ? [languages.CompletionItemTag.Deprecated] : undefined, // Use deprecated tag to mark required (will show differently)
      };
    });
}

// Store editor instance globally for autocomplete access
let currentEditorInstance: editor.IStandaloneCodeEditor | null = null;

export function setCurrentEditorInstance(
  editorInstance: editor.IStandaloneCodeEditor | null
): void {
  currentEditorInstance = editorInstance;
}

export function registerPlaygroundAutocompletion(
  monaco: typeof import("monaco-editor"),
  options: AutocompletionsMetadata
): IDisposable {
  return monaco.languages.registerCompletionItemProvider("typescript", {
    provideCompletionItems: (model, position) => {
      // Get line content and cursor position from model
      const lineNumber = position.lineNumber;
      const column = position.column;
      const lineContent = model.getLineContent(lineNumber);
      const lineTextUpToCursor = lineContent.substring(0, column - 1);
      const fullLineText = lineContent;
      const cursorPos = model.getOffsetAt(position);

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      let suggestions: languages.CompletionItem[] = [];

      if (isInsideAttribute(fullLineText, cursorPos)) {
        // never show suggestions from any kind inside attributes
        return { suggestions: [] };
      }

      const newTagName = getNewTagContext(lineTextUpToCursor);
      if (newTagName !== null) {
        // if the cursor is in a new tag context, generate component name completions
        const adjustedRange = {
          ...range,
          startColumn: Math.max(1, position.column - newTagName.length),
        };
        suggestions = generateComponentNameCompletions(
          newTagName,
          options,
          adjustedRange
        );
      } else {
        // otherwise, generate prop completions
        if (!shouldTriggerPropSuggestions(fullLineText, cursorPos)) {
          return { suggestions: [] };
        }
        const match = lineTextUpToCursor.match(/<(\w+)\s[\s\S]*?(\w*)$/);
        if (!match) {
          return { suggestions: [] };
        }
        const usedProps = extractAlreadyUsedProps(fullLineText, cursorPos);
        const [, componentName, partialPropName] = match;
        const adjustedRange = {
          ...range,
          startColumn: Math.max(1, position.column - partialPropName.length),
        };
        suggestions = generatePropCompletions(
          componentName,
          options,
          partialPropName,
          usedProps,
          adjustedRange
        );
      }

      return { suggestions };
    },
    triggerCharacters: ["<", " "],
  });
}

// Legacy export for backward compatibility
export default function autocomplete(options: AutocompletionsMetadata): null {
  // This is a no-op now - autocomplete is registered via registerPlaygroundAutocompletion
  // This function exists to maintain the same API structure
  return null;
}

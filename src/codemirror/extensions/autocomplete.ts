import type { editor, IDisposable } from "monaco-editor";
import { languages } from "monaco-editor";
import { AutocompletionsMetadata } from "@/types";
import {
  getNewTagContext,
  shouldTriggerPropSuggestions,
  extractAlreadyUsedProps,
  isInsideAttribute,
} from "../utils/autocomplete-utils";

/**
 * Extracts string literal values from a type that could be:
 * - A string union type (array of strings)
 * - A single string
 * - A union type with string literals
 */
export function extractStringLiteralsFromType(
  type: string | string[]
): string[] {
  if (!type) {
    return [];
  }

  // If it's an array, it's likely a union type
  if (Array.isArray(type)) {
    // Filter for string literals (values that look like string literals)
    return type
      .map((t) => {
        const str = String(t);
        // Check if it's a quoted string literal
        if (
          (str.startsWith('"') && str.endsWith('"')) ||
          (str.startsWith("'") && str.endsWith("'"))
        ) {
          return str.slice(1, -1); // Remove quotes
        }
        // Check if it's a plain string value (not a type name)
        if (
          /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str) &&
          ![
            "string",
            "number",
            "boolean",
            "object",
            "array",
            "function",
          ].includes(str.toLowerCase())
        ) {
          return str;
        }
        return null;
      })
      .filter((v): v is string => v !== null && typeof v === "string");
  }

  // If it's a single string, check if it contains union syntax
  const typeStr = String(type);
  // Match patterns like: "small" | "medium" | "large" or 'small' | 'medium' | 'large'
  const unionMatch = typeStr.match(
    /(["'])([^"']+)\1(\s*\|\s*(["'])([^"']+)\4)*/g
  );
  if (unionMatch) {
    return unionMatch
      .flatMap((match) => {
        // Extract all quoted values from the union
        const quotedValues = match.match(/(["'])([^"']+)\1/g);
        return quotedValues
          ? quotedValues.map((qv) => qv.slice(1, -1)) // Remove quotes
          : [];
      })
      .filter(Boolean);
  }

  // If it's a simple string that's not a type name, return it
  if (
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(typeStr) &&
    !["string", "number", "boolean", "object", "array", "function"].includes(
      typeStr.toLowerCase()
    )
  ) {
    return [typeStr];
  }

  return [];
}

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
      insertText: componentName,
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
      // Format type string for display
      // If it's an array of string literals, format as union with quotes
      // If it's a string, use it as-is (might already be formatted)
      let typeStr: string;
      if (Array.isArray(type)) {
        // Check if all elements are string literals (not type names)
        const allStringLiterals = type.every(
          (t) =>
            typeof t === "string" &&
            ![
              "string",
              "number",
              "boolean",
              "object",
              "array",
              "function",
              "unknown",
            ].includes(t.toLowerCase())
        );
        if (allStringLiterals) {
          // Format as quoted union: "small" | "medium" | "large"
          typeStr = type.map((t) => `"${t}"`).join(" | ");
        } else {
          // Mixed types, join with |
          typeStr = type.join(" | ");
        }
      } else {
        typeStr = String(type);
      }
      // Determine insertText based on type:
      // - boolean: just the prop name (e.g., "active")
      // - string: with quotes (e.g., 'name="value"')
      // - other types: with braces (e.g., 'count={value}')
      let insertText: string;

      // Helper to check if type is boolean
      const isBooleanType = (t: string | string[]): boolean => {
        if (Array.isArray(t)) {
          // For unions, only treat as boolean if it's exclusively boolean
          return t.length === 1 && (t[0] === "boolean" || t[0] === "bool");
        }
        const typeStr = String(t);
        return typeStr === "boolean" || typeStr === "bool";
      };

      // Helper to check if type is string
      const isStringType = (t: string | string[]): boolean => {
        if (Array.isArray(t)) {
          return t.some((el) => String(el) === "string");
        }
        const typeStr = String(t);
        return typeStr === "string" || typeStr.includes("string");
      };

      if (isBooleanType(type)) {
        insertText = name;
      } else if (isStringType(type)) {
        insertText = `${name}="$1"`;
      } else {
        insertText = `${name}={$1}`;
      }
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
    provideCompletionItems: (model, position, _context) => {
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

      // Check if we're inside a string attribute value (between quotes)
      // Pattern 1: <Component prop="" (string attribute)
      const stringAttributeMatch = lineTextUpToCursor.match(
        /<(\w+)\s+([\w-]+)\s*=\s*["']([^"']*)$/
      );
      // Pattern 2: <Component prop={""} (JSX expression with string literal)
      const jsxExpressionMatch = lineTextUpToCursor.match(
        /<(\w+)\s+([\w-]+)\s*=\s*\{\s*["']([^"']*)$/
      );

      const attributeMatch = stringAttributeMatch || jsxExpressionMatch;
      if (attributeMatch) {
        // We're inside a string attribute value (size="" or size={""})
        // Let Monaco's TypeScript service handle autocomplete automatically
        // It will use the registered type definitions to provide string literal suggestions
        return undefined;
      }

      // Check if we're inside an attribute value (including JSX expressions with quotes)
      // If so, let Monaco handle it - don't show our custom suggestions
      if (isInsideAttribute(fullLineText, cursorPos)) {
        // Check if we're in a JSX expression with quotes (e.g., size={""})
        const jsxExpressionWithQuotes = lineTextUpToCursor.match(
          /<(\w+)\s+([\w-]+)\s*=\s*\{\s*["']/
        );
        if (jsxExpressionWithQuotes) {
          // Let Monaco handle string literal completions - don't show props
          return undefined;
        }
        // For other attribute contexts (like inside braces without quotes), don't show suggestions
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
        // Always return suggestions for component names, even if empty (to show we handled it)
        if (suggestions.length > 0) {
          return { suggestions };
        }
        // If no component matches, return empty array (don't block, but show we handled it)
        return { suggestions: [] };
      } else {
        // Check if we're inside a JSX expression with quotes (e.g., size={""})
        // If so, let Monaco handle it - don't show prop suggestions
        const jsxExpressionWithQuotes = lineTextUpToCursor.match(
          /<(\w+)\s+([\w-]+)\s*=\s*\{\s*["']/
        );
        if (jsxExpressionWithQuotes) {
          // Let Monaco handle string literal completions
          return undefined;
        }

        // Check if we're inside an attribute value (but not in quotes)
        // If so, don't show prop suggestions
        const isInAttributeValue = /=\s*\{[^}]*$/.test(lineTextUpToCursor);
        if (isInAttributeValue) {
          return undefined;
        }

        // otherwise, generate prop completions (for automatic triggers)
        if (!shouldTriggerPropSuggestions(fullLineText, cursorPos)) {
          // Return undefined to allow Monaco's default completions when not in prop context
          return undefined;
        }
        const match = lineTextUpToCursor.match(/<(\w+)\s[\s\S]*?(\w*)$/);
        if (!match) {
          return undefined;
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

      // Return our custom suggestions, but don't block Monaco's default TypeScript completions
      // If we have suggestions, return them; otherwise return undefined to allow default completions
      if (suggestions.length > 0) {
        return { suggestions };
      }
      // Return undefined to allow Monaco's default TypeScript language service completions
      return undefined;
    },
    triggerCharacters: ["<", " ", '"', "'", "{"],
  });
}

// Legacy export for backward compatibility
export default function autocomplete(_options: AutocompletionsMetadata): null {
  // This is a no-op now - autocomplete is registered via registerPlaygroundAutocompletion
  // This function exists to maintain the same API structure
  return null;
}

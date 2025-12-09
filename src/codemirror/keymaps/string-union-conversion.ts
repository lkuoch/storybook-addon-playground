import type { editor } from "monaco-editor";
import { getEditorStateInfo } from "../utils/extensions-utils";
import { AutocompletionsMetadata } from "@/types";
import { extractStringLiteralsFromType } from "../extensions/autocomplete";

/**
 * Converts propName={} to propName="" for string union types
 * Returns true if conversion was made, false otherwise
 */
function convertEmptyJsxExpressionToString(
  editorInstance: editor.IStandaloneCodeEditor,
  options: AutocompletionsMetadata
): boolean {
  const { fullLineText, lineTextUpToCursor } =
    getEditorStateInfo(editorInstance);
  const position = editorInstance.getPosition();
  const model = editorInstance.getModel();

  if (!position || !model) {
    return false;
  }

  // Match pattern: <Component propName={} (cursor right after the closing brace or inside)
  // Also match: <Component propName={} (with closing brace after cursor)
  const emptyJsxExpressionMatch = lineTextUpToCursor.match(
    /<(\w+)\s+([\w-]+)\s*=\s*\{\s*$/
  );

  // Also check if cursor is right before closing brace: propName={ }
  const beforeClosingBraceMatch = lineTextUpToCursor.match(
    /<(\w+)\s+([\w-]+)\s*=\s*\{\s+$/
  );

  const match = emptyJsxExpressionMatch || beforeClosingBraceMatch;

  if (!match) {
    return false;
  }

  const [, componentName, propName] = match;
  const componentProps = options[componentName];

  if (!componentProps?.length) {
    return false;
  }

  // Find the prop info
  const normalizedProps = componentProps.flatMap((propItem) =>
    Object.entries(propItem).map(([name, propInfo]) => ({
      name,
      ...propInfo,
    }))
  );

  const propInfo = normalizedProps.find((p) => p.name === propName);
  if (!propInfo) {
    return false;
  }

  // Check if this prop has string literal values (string union type)
  const stringLiterals = extractStringLiteralsFromType(propInfo.type);
  if (stringLiterals.length === 0) {
    return false; // Not a string union, don't convert
  }

  // Find the position of the opening brace
  const braceStartIndex = lineTextUpToCursor.lastIndexOf("{");
  if (braceStartIndex === -1) {
    return false;
  }

  const afterCursor = fullLineText.substring(position.column - 1);

  // Check if there's a closing brace right after cursor (with optional whitespace)
  const closingBraceMatch = afterCursor.match(/^\s*(\})/);
  const hasClosingBrace = closingBraceMatch !== null;

  // Calculate the range to replace
  // We want to replace from inside the opening brace to after the closing brace
  const startColumn = braceStartIndex + 1; // Column after the opening brace
  let endColumn: number;

  if (hasClosingBrace && closingBraceMatch) {
    // Include the closing brace and any whitespace before it
    const whitespaceLength = closingBraceMatch[0].length - 1; // Length minus the brace
    endColumn = position.column + whitespaceLength + 1; // Include whitespace and closing brace
  } else {
    // No closing brace found, just replace up to cursor
    endColumn = position.column;
  }

  // Replace {} with ""
  const edit = {
    range: {
      startLineNumber: position.lineNumber,
      startColumn: startColumn,
      endLineNumber: position.lineNumber,
      endColumn: endColumn,
    },
    text: '""',
  };

  editorInstance.executeEdits("convert-jsx-to-string", [edit]);

  // Position cursor inside the quotes (after the opening quote)
  const newPosition = {
    lineNumber: position.lineNumber,
    column: startColumn + 1, // Position after the opening quote
  };
  editorInstance.setPosition(newPosition);

  return true;
}

export default function stringUnionConversion(
  editorInstance: editor.IStandaloneCodeEditor,
  options: AutocompletionsMetadata
): boolean {
  return convertEmptyJsxExpressionToString(editorInstance, options);
}

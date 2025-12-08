import type { editor } from "monaco-editor";
import {
  getEditorStateInfo,
  parseTagFromLineText,
} from "../utils/extensions-utils";

function insertAutoClosingTagCommand(
  editorInstance: editor.IStandaloneCodeEditor
): boolean {
  const { fullLineText, lineTextUpToCursor, lineTextAfterCursor } =
    getEditorStateInfo(editorInstance);

  const tagName = parseTagFromLineText(lineTextUpToCursor);

  if (!tagName) {
    return false;
  }

  if (isSelfClosingTag(fullLineText)) {
    return false;
  }

  if (isInsertingContentInsideTags(lineTextAfterCursor)) {
    return false;
  }

  if (
    lineTextUpToCursor.trim().endsWith("/") ||
    lineTextAfterCursor.startsWith(">")
  ) {
    return false;
  }

  const position = editorInstance.getPosition();
  if (!position) {
    return false;
  }

  const model = editorInstance.getModel();
  if (!model) {
    return false;
  }

  // Insert the closing tag after the '>' that was just typed
  // The '>' is already inserted, so we just need to add </tagName>
  const insertText = `</${tagName}>`;
  const edit = {
    range: {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    },
    text: insertText,
  };

  editorInstance.executeEdits("auto-close-tag", [edit]);

  // Move cursor to position between the opening and closing tags (inside the JSX element)
  // After inserting </tagName>, the cursor is at the end of the inserted text
  // We need to move it back to right after the '>' of the opening tag
  // The original position.column is right after the '>', so that's where we want the cursor
  const newPosition = {
    lineNumber: position.lineNumber,
    column: position.column, // Position right after the '>' of the opening tag (between the tags)
  };
  editorInstance.setPosition(newPosition);

  return true;
}

function isSelfClosingTag(lineText: string): boolean {
  return /<\w+(\s+\w+="[^"]*")*\s*\/>$/.test(lineText);
}

function isInsertingContentInsideTags(lineTextAfterCursor: string): boolean {
  // check if there's a closing tag after the cursor (meaning the inserted `>` is part of the content)
  return /<\/[a-zA-Z0-9]+>/.test(lineTextAfterCursor);
}

export default insertAutoClosingTagCommand;

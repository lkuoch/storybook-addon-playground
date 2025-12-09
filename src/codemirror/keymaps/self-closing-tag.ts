import type { editor } from "monaco-editor";
import {
  getEditorStateInfo,
  parseTagFromLineText,
} from "../utils/extensions-utils";

function insertSelfClosingTagCommand(
  editorInstance: editor.IStandaloneCodeEditor
): boolean {
  const { lineTextUpToCursor, lineTextAfterCursor } =
    getEditorStateInfo(editorInstance);

  const tagName = parseTagFromLineText(lineTextUpToCursor);

  if (!tagName) {
    return false;
  }

  if (!isInsideOpenTag(lineTextUpToCursor)) {
    return false;
  }

  if (isFollowedByCloseTag(lineTextAfterCursor)) {
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

  // Insert self-closing tag syntax
  const edit = {
    range: {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    },
    text: "/>",
  };

  editorInstance.executeEdits("self-close-tag", [edit]);

  // Move cursor to position after the inserted text
  const newPosition = {
    lineNumber: position.lineNumber,
    column: position.column + 2,
  };
  editorInstance.setPosition(newPosition);

  return true;
}

function isInsideOpenTag(lineTextUpToCursor: string): boolean {
  // Checks if the cursor is within an open tag (e.g., after "<Button" or "<Button prop").
  return /<\w+[^>]*$/.test(lineTextUpToCursor);
}

function isFollowedByCloseTag(lineTextAfterCursor: string): boolean {
  // Checks if the cursor's position in the document is followed by a closing part of a tag or self-closing syntax.
  return (
    /<\/?\w+>/.test(lineTextAfterCursor) || /\/>/.test(lineTextAfterCursor)
  );
}

export default insertSelfClosingTagCommand;

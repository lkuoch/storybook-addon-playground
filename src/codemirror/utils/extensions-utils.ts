import type { editor } from "monaco-editor";

export interface EditorStateInfo {
  cursorPos: number;
  fullLineText: string;
  lineTextUpToCursor: string;
  lineTextAfterCursor: string;
}

export function parseTagFromLineText(lineText: string): string {
  return lineText.match(/<([a-zA-Z0-9]+)/)?.[1];
}

export function getEditorStateInfo(
  editorInstance: editor.IStandaloneCodeEditor
): EditorStateInfo {
  const model = editorInstance.getModel();
  const position = editorInstance.getPosition();
  
  if (!model || !position) {
    return {
      cursorPos: 0,
      fullLineText: "",
      lineTextUpToCursor: "",
      lineTextAfterCursor: "",
    };
  }

  const lineNumber = position.lineNumber;
  const column = position.column;
  const line = model.getLineContent(lineNumber);
  
  // Convert line/column to offset
  const cursorPos = model.getOffsetAt(position);
  
  const lineTextUpToCursor = line.substring(0, column - 1);
  const lineTextAfterCursor = line.substring(column - 1);

  return {
    cursorPos,
    fullLineText: line,
    lineTextUpToCursor,
    lineTextAfterCursor,
  };
}

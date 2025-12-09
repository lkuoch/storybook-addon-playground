import React, { forwardRef, lazy, useImperativeHandle, useRef } from "react";
import { Loader } from "storybook/internal/components";
import EditorComponent from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import "./Editor.module.css";
import { EditorInitialState, EditorTheme } from "@/types";

interface EditorProps {
  code: string;
  onChange: (newVal: string) => void;
  placeholder?: string;
  loading?: boolean;
  theme: EditorTheme;
  style?: React.CSSProperties;
  language?: string;
  options?: editor.IStandaloneEditorConstructionOptions;
  onMount?: (editor: editor.IStandaloneCodeEditor) => void;
  initialState?: EditorInitialState;
}

export type MonacoEditorRef = editor.IStandaloneCodeEditor | null;

type EditorComponentType = React.ForwardRefExoticComponent<
  EditorProps & React.RefAttributes<MonacoEditorRef>
>;

const Editor: EditorComponentType = forwardRef(
  (
    {
      code,
      onChange,
      placeholder,
      loading,
      theme,
      style,
      language = "typescript",
      options,
      onMount,
      initialState,
    },
    ref
  ) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    useImperativeHandle(ref, () => editorRef.current, []);

    const handleEditorDidMount = (
      editor: editor.IStandaloneCodeEditor,
      monaco: typeof import("monaco-editor")
    ) => {
      editorRef.current = editor;

      // Restore view state if provided
      if (initialState?.json?.viewState) {
        editor.restoreViewState(initialState.json.viewState);
      }

      if (onMount) {
        onMount(editor);
      }
    };

    const editorOptions: editor.IStandaloneEditorConstructionOptions = {
      fontSize: 16,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      readOnly: false, // Explicitly ensure editor is not read-only
      padding: {
        top: 16,
      },
      ...options,
    };

    return (
      <>
        {loading ? (
          <Loader />
        ) : (
          <EditorComponent
            value={code}
            language={language}
            theme={typeof theme === "string" ? theme : "vs"}
            onChange={(value) => onChange(value || "")}
            onMount={handleEditorDidMount}
            options={editorOptions}
            loading={loading ? <Loader /> : undefined}
          />
        )}
      </>
    );
  }
);

export default Editor;

import React, { Suspense, useMemo, useRef, useEffect } from "react";
import { Editor, EditorToolbar, MonacoEditorRef } from "../Editor";
import {
  useInitialCode,
  useBroadcastEditorChanges,
  useAutoOpenPlayground,
  useEditorTheme,
  usePlaygroundArgs,
  usePersistence,
} from "@/hooks";
import { AddonPanel } from "storybook/internal/components";
import { Addon_RenderOptions } from "storybook/internal/types";
import { useAddonState, useParameter } from "storybook/manager-api";
import {
  ADDON_ID_FOR_PARAMETERS,
  DEFAULT_ADDON_PARAMETERS,
  DEFAULT_ADDON_STATE,
  PANEL_ID,
} from "@/consts";
import { PlaygroundParameters, PlaygroundState } from "@/types";
import styles from "./Panel.module.css";
import {
  registerPlaygroundAutocompletion,
  setCurrentEditorInstance,
} from "@/codemirror/extensions";
import { registerPlaygroundKeybindings } from "@/codemirror/keymaps";
import loader from "@monaco-editor/loader";
import type { editor } from "monaco-editor";

const Panel: React.FC<Addon_RenderOptions> = ({ active }) => {
  const editorRef = useRef<MonacoEditorRef>(null);
  const autocompleteDisposableRef = useRef<{ dispose: () => void } | null>(
    null
  );
  const keybindingsDisposableRef = useRef<(() => void) | null>(null);

  useInitialCode();
  useBroadcastEditorChanges();
  useAutoOpenPlayground();
  usePersistence();
  const theme = useEditorTheme();
  const { updateCode } = usePlaygroundArgs();
  const { autocompletions } = useParameter<PlaygroundParameters>(
    ADDON_ID_FOR_PARAMETERS,
    DEFAULT_ADDON_PARAMETERS
  );
  const [state] = useAddonState<PlaygroundState>(PANEL_ID, DEFAULT_ADDON_STATE);

  const { code, hasInitialCodeLoaded, editorState } = state;

  const editorInitialState = useMemo(
    () => ({
      json: editorState?.jsx,
    }),
    [editorState]
  );

  // Register autocomplete and keybindings when editor is mounted
  const handleEditorMount = async (
    editorInstance: editor.IStandaloneCodeEditor
  ) => {
    // Store editor instance globally for autocomplete access
    setCurrentEditorInstance(editorInstance);

    // Prevent Storybook from intercepting number keys (0-9) used for story navigation
    // Only block when editor is focused and only for number keys without modifiers
    const editorContainer = editorInstance.getContainerDomNode();
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if editor is focused
      if (!editorInstance.hasTextFocus()) {
        return; // Don't block if editor isn't focused
      }

      // Only block number keys (0-9) without modifier keys
      // Storybook uses number keys for story navigation, but we want them in the editor
      const key = event.key;
      const isNumberKey = key >= "0" && key <= "9";
      const hasModifier =
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;

      // Only stop propagation for number keys without modifiers
      // This allows Cmd+1, Ctrl+1, etc. to work normally (for editor shortcuts)
      if (isNumberKey && !hasModifier) {
        event.stopPropagation();
      }
      // All other keys (arrows, backspace, Cmd/Ctrl combos, etc.) work normally
    };

    // Use bubbling phase (not capture) so Monaco handles events first
    editorContainer.addEventListener("keydown", handleKeyDown, false);

    // Store cleanup function
    const cleanupKeyDown = () => {
      editorContainer.removeEventListener("keydown", handleKeyDown, false);
    };

    // Store cleanup in a way we can access it later
    (editorInstance as any).__keydownCleanup = cleanupKeyDown;

    // Load Monaco and register autocomplete
    const monaco = await loader.init();

    // Dispose previous autocomplete if exists
    if (autocompleteDisposableRef.current) {
      autocompleteDisposableRef.current.dispose();
    }

    // Register autocomplete for JSX
    if (autocompletions) {
      autocompleteDisposableRef.current = registerPlaygroundAutocompletion(
        monaco,
        autocompletions
      );
    }

    // Register keybindings
    if (keybindingsDisposableRef.current) {
      keybindingsDisposableRef.current();
    }
    keybindingsDisposableRef.current =
      registerPlaygroundKeybindings(editorInstance);

    // Restore view state if available
    if (editorInitialState?.json?.viewState) {
      editorInstance.restoreViewState(editorInitialState.json.viewState);
    }
  };

  // Update autocomplete when autocompletions change
  useEffect(() => {
    const updateAutocomplete = async () => {
      if (!editorRef.current || !autocompletions) {
        return;
      }

      const monaco = await loader.init();

      if (autocompleteDisposableRef.current) {
        autocompleteDisposableRef.current.dispose();
      }

      autocompleteDisposableRef.current = registerPlaygroundAutocompletion(
        monaco,
        autocompletions
      );
    };

    updateAutocomplete();

    return () => {
      if (autocompleteDisposableRef.current) {
        autocompleteDisposableRef.current.dispose();
        autocompleteDisposableRef.current = null;
      }
    };
  }, [autocompletions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setCurrentEditorInstance(null);
      if (autocompleteDisposableRef.current) {
        autocompleteDisposableRef.current.dispose();
      }
      if (keybindingsDisposableRef.current) {
        keybindingsDisposableRef.current();
      }
      // Cleanup keydown event listener
      if (editorRef.current && (editorRef.current as any).__keydownCleanup) {
        (editorRef.current as any).__keydownCleanup();
      }
    };
  }, []);

  const editorOptions: editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      folding: false,
      lineNumbers: "on",
      renderLineHighlight: "all",
      readOnly: false, // Explicitly ensure editor is not read-only
      scrollbar: {
        vertical: "auto",
        horizontal: "auto",
      },
    }),
    []
  );

  return (
    <AddonPanel active={active}>
      <div className={styles.panel}>
        <EditorToolbar editorRef={editorRef} />
        <div className={styles.editorWrapper}>
          <div className={styles.editor}>
            <Suspense fallback={"Loading Editor..."}>
              <Editor
                ref={editorRef}
                loading={!hasInitialCodeLoaded}
                placeholder="Insert your JSX code here"
                code={code?.jsx || ""}
                theme={theme}
                language="typescript"
                options={editorOptions}
                onMount={handleEditorMount}
                onChange={updateCode}
                initialState={editorInitialState}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </AddonPanel>
  );
};

export default Panel;

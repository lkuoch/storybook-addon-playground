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
// Custom autocomplete removed - using Monaco's built-in TypeScript service
import { registerPlaygroundKeybindings } from "@/codemirror/keymaps";
import { generateTypeDefinitions } from "../../monaco/generate-type-definitions";
import { REACT_TYPES } from "virtual:react-types";
import { FILTERED_LIBS } from "virtual:filtered-libs";
import loader from "@monaco-editor/loader";
import type { editor } from "monaco-editor";

const Panel: React.FC<Addon_RenderOptions> = ({ active }) => {
  const editorRef = useRef<MonacoEditorRef>(null);
  const keybindingsDisposableRef = useRef<(() => void) | null>(null);
  const typeDefinitionsDisposableRef = useRef<{ dispose: () => void } | null>(
    null
  );
  const reactTypesDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const libDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);

  useInitialCode();
  useBroadcastEditorChanges();
  useAutoOpenPlayground();
  usePersistence();
  const theme = useEditorTheme();
  const { updateCode } = usePlaygroundArgs();
  const { autocompletions, reactDocgenOutput } =
    useParameter<PlaygroundParameters>(
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

  // Register type definitions and keybindings when editor is mounted
  const handleEditorMount = async (
    editorInstance: editor.IStandaloneCodeEditor
  ) => {
    // Prevent Storybook from intercepting keyboard events when editor has focus
    // This prevents Storybook shortcuts from interfering with typing in the editor
    const editorContainer = editorInstance.getContainerDomNode();
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if editor is focused
      if (!editorInstance.hasTextFocus()) {
        return; // Don't block if editor isn't focused
      }

      // Stop propagation for all keys when editor has focus to prevent Storybook shortcuts
      // This ensures all typing goes to the editor, not to Storybook's shortcut handlers
      // Exception: Don't block modifier-only keys (like Cmd/Ctrl alone) as they might be needed
      const hasModifier =
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
      const isModifierOnly =
        hasModifier &&
        !event.key.match(/^[a-zA-Z0-9]$/) &&
        ![
          "Enter",
          "Space",
          "Tab",
          "Backspace",
          "Delete",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(event.key);

      // Stop propagation for all keys except modifier-only combinations
      // This prevents Storybook from intercepting typing, but allows editor shortcuts
      if (!isModifierOnly) {
        event.stopPropagation();
      }
    };

    // Use bubbling phase (not capture) so Monaco handles events first
    editorContainer.addEventListener("keydown", handleKeyDown, false);

    // Store cleanup function
    const cleanupKeyDown = () => {
      editorContainer.removeEventListener("keydown", handleKeyDown, false);
    };

    // Store cleanup in a way we can access it later
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editorInstance as any).__keydownCleanup = cleanupKeyDown;

    // Load Monaco
    const monaco = await loader.init();

    // Configure TypeScript compiler options FIRST (before registering types)
    // This ensures the compiler is ready when types are added
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      noLib: true, // Use custom filtered lib
      // Strict type checking options
      strict: true,
      noImplicitAny: false,
    });

    // Register Filtered Libs (standard JS/DOM but without noisy globals)
    if (FILTERED_LIBS) {
      if (libDisposableRef.current) {
        libDisposableRef.current.dispose();
      }
      libDisposableRef.current =
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          FILTERED_LIBS,
          "file:///lib.d.ts"
        );
    }

    // Register React types
    if (REACT_TYPES) {
      if (reactTypesDisposableRef.current) {
        reactTypesDisposableRef.current.dispose();
      }
      reactTypesDisposableRef.current =
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          REACT_TYPES,
          "file:///react.d.ts"
        );
    }

    // Register type definitions from react-docgen
    if (reactDocgenOutput) {
      const typeDefinitions = generateTypeDefinitions(reactDocgenOutput);
      if (typeDefinitions) {
        // Dispose previous type definitions if they exist
        if (typeDefinitionsDisposableRef.current) {
          typeDefinitionsDisposableRef.current.dispose();
        }

        // Register type definitions with Monaco's TypeScript language service
        // Use a proper file URI that Monaco can resolve
        const typeDefUri = "file:///components.d.ts";

        // Add the type definitions to Monaco's TypeScript language service
        const disposable =
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            typeDefinitions,
            typeDefUri
          );
        typeDefinitionsDisposableRef.current = disposable;

        // No longer manually injecting reference directives into the model
      }
    }

    // Register keybindings (for auto-closing tags, etc.)
    if (keybindingsDisposableRef.current) {
      keybindingsDisposableRef.current();
    }
    keybindingsDisposableRef.current = registerPlaygroundKeybindings(
      editorInstance,
      autocompletions
    );

    // Restore view state if available
    if (editorInitialState?.json?.viewState) {
      editorInstance.restoreViewState(editorInitialState.json.viewState);
    }
  };

  // Update type definitions when they change
  useEffect(() => {
    const updateTypeDefinitions = async () => {
      if (!editorRef.current || !reactDocgenOutput) {
        return;
      }

      const monaco = await loader.init();
      const typeDefinitions = generateTypeDefinitions(reactDocgenOutput);
      if (typeDefinitions) {
        if (typeDefinitionsDisposableRef.current) {
          typeDefinitionsDisposableRef.current.dispose();
        }

        const disposable =
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            typeDefinitions,
            "file:///components.d.ts"
          );
        typeDefinitionsDisposableRef.current = disposable;

        // Register completion item provider to force components to the top
        if (completionDisposableRef.current) {
          completionDisposableRef.current.dispose();
        }

        const componentNames = Object.values(reactDocgenOutput)
          .flat()
          .map((c) => c.displayName)
          .filter((name): name is string => !!name);

        completionDisposableRef.current =
          monaco.languages.registerCompletionItemProvider("typescript", {
            provideCompletionItems: (model, position) => {
              const word = model.getWordUntilPosition(position);
              const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
              };

              const suggestions = componentNames.map((name) => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: name,
                sortText: "!" + name, // "!" sorts before alphanumerics
                detail: "Component",
                range: range,
              }));
              return { suggestions };
            },
          });

        // No longer manually injecting reference directives into the model
      }
    };

    updateTypeDefinitions();

    return () => {
      if (typeDefinitionsDisposableRef.current) {
        typeDefinitionsDisposableRef.current.dispose();
        typeDefinitionsDisposableRef.current = null;
      }
    };
  }, [reactDocgenOutput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeDefinitionsDisposableRef.current) {
        typeDefinitionsDisposableRef.current.dispose();
      }
      if (keybindingsDisposableRef.current) {
        keybindingsDisposableRef.current();
      }
      if (reactTypesDisposableRef.current) {
        reactTypesDisposableRef.current.dispose();
      }
      if (libDisposableRef.current) {
        libDisposableRef.current.dispose();
      }
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
      // Cleanup keydown event listener
      const currentEditor = editorRef.current;
      if (currentEditor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanup = (currentEditor as any).__keydownCleanup;
        if (cleanup) {
          cleanup();
        }
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
      // Enable suggestions and quick suggestions
      // Monaco's TypeScript service will provide autocomplete automatically once types are registered
      suggestOnTriggerCharacters: true,
      fixedOverflowWidgets: true, // Helps with widget positioning
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true, // Enable suggestions in strings (for string literal unions)
      },
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: "on",
      tabCompletion: "on",
      wordBasedSuggestions: "allDocuments",
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

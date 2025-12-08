import { useAddonState, useParameter } from "storybook/manager-api";
import { useCallback } from "react";
import { PlaygroundArgs, PlaygroundState, PlaygroundParameters } from "@/types";
import {
  DEFAULT_ADDON_STATE,
  PANEL_ID,
  ADDON_ID_FOR_PARAMETERS,
  DEFAULT_ADDON_PARAMETERS,
} from "@/consts";
import { clearStoredCode } from "@/utils";

const usePlaygroundArgs = (): PlaygroundArgs => {
  const [state, setState] = useAddonState<PlaygroundState>(
    PANEL_ID,
    DEFAULT_ADDON_STATE
  );
  const { code } = state;
  const { introCode } = useParameter<PlaygroundParameters>(
    ADDON_ID_FOR_PARAMETERS,
    DEFAULT_ADDON_PARAMETERS
  );

  const updateCode = useCallback(
    (newCode: string) => {
      const updatedCode = { ...code, jsx: newCode };
      setState((state) => ({ ...state, code: updatedCode }));
    },
    [code, setState]
  );

  const resetCode = useCallback(() => {
    clearStoredCode();

    const resetValue = introCode?.jsx ?? "";
    const updatedCode = { ...code, jsx: resetValue };
    setState((state) => ({ ...state, code: updatedCode }));
  }, [code, setState, introCode]);

  return { updateCode, resetCode };
};

export default usePlaygroundArgs;

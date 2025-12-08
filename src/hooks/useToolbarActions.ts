import { useCallback } from "react";
import { formatJsx } from "@/utils";
import { Code } from "@/types";

interface UseToolbarActionsReturnType {
  onReset: () => void;
  onFormatCode: () => void;
}

const useToolbarActions = (
  code: Code,
  updateCode: (newCode: string) => void,
  resetCode: () => void
): UseToolbarActionsReturnType => {
  const onFormatCode = useCallback(async () => {
    try {
      const formatted = await formatJsx(code.jsx);
      if (formatted === code.jsx) {
        return;
      }
      updateCode(formatted);
    } catch (error) {
      console.error(error.message);
    }
  }, [code, updateCode]);

  const onReset = useCallback(() => {
    resetCode();
  }, [resetCode]);

  return { onFormatCode, onReset };
};

export default useToolbarActions;

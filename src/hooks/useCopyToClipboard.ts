import { useCallback, useMemo, useState } from "react";
import { Code, PlaygroundState } from "@/types";
import { useAddonState } from "storybook/manager-api";
import { DEFAULT_ADDON_STATE, PANEL_ID } from "@/consts";

const useCopyToClipboard = (code: Code) => {
  const [isCopied, setCopied] = useState(false);

  const jsxCode = code.jsx || "";

  const shouldAllowCopy = useMemo(() => jsxCode.length > 0, [jsxCode.length]);

  const onCopy = useCallback(() => {
    if (!shouldAllowCopy) {
      return;
    }
    navigator.clipboard.writeText(jsxCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [jsxCode, shouldAllowCopy]);

  return { onCopy, isCopied, shouldAllowCopy };
};

export default useCopyToClipboard;

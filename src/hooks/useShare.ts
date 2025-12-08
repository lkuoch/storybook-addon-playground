import { useCallback, useMemo, useState } from "react";
import { Code, PlaygroundParameters } from "@/types";
import { compressAndEncode } from "@/utils";
import {
  ADDON_ID_FOR_PARAMETERS,
  DEFAULT_ADDON_PARAMETERS,
  SNIPPET_SHARE_QUERY_ID,
} from "@/consts";
import { useParameter } from "storybook/manager-api";

interface UseShareReturnType {
  onShare: () => Promise<void>;
  isShareCopied: boolean;
  shouldAllowShare: boolean;
}

const useShare = (code: Code): UseShareReturnType => {
  const { share: enableShare } = useParameter<PlaygroundParameters>(
    ADDON_ID_FOR_PARAMETERS,
    DEFAULT_ADDON_PARAMETERS
  );
  const [isCopied, setCopied] = useState(false);

  const shouldAllowShare = useMemo(
    () => Boolean(code?.jsx || code?.css) && enableShare,
    [code?.css, code?.jsx, enableShare]
  );

  const onShare = useCallback(async () => {
    if (!shouldAllowShare) {
      return;
    }
    const encoded = compressAndEncode(code);

    // Use the current window location to preserve the exact story path format
    // This ensures we use the actual current story path (e.g., /story/playground--playground)
    // rather than generating a new one that might have the wrong format
    const currentUrl = new URL(window.location.href);

    // Clear any existing snippet parameter and add the new one
    currentUrl.searchParams.delete(SNIPPET_SHARE_QUERY_ID);
    currentUrl.searchParams.set(SNIPPET_SHARE_QUERY_ID, encoded);

    navigator.clipboard.writeText(currentUrl.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code, shouldAllowShare]);

  return { onShare, isShareCopied: isCopied, shouldAllowShare };
};

export default useShare;

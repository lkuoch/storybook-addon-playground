import lzString from "lz-string";
const {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} = lzString;
import { Code } from "@/types";

export function compressAndEncode(code: Code): string {
  return compressToEncodedURIComponent(JSON.stringify(code));
}

export function decodeAndDecompress(encodedCode: string): Code {
  return JSON.parse(decompressFromEncodedURIComponent(encodedCode));
}

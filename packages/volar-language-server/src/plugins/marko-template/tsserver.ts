import type { TagMeta } from "@marko/component-meta";

import {
  getComponentMetaRequest,
  type GetComponentMetaRequestArgs,
} from "../../ts-plugin/requests";

export interface MarkoTsServer {
  getComponentMeta(
    fileName: string,
    tagName: string,
    tagFileName?: string,
  ): Promise<TagMeta | undefined>;
}

export type SendTsServerRequest = <T>(
  command: string,
  args: unknown,
) => Promise<T>;

export function createMarkoTsServer(
  sendRequest: SendTsServerRequest,
): MarkoTsServer {
  return {
    getComponentMeta(fileName, tagName, tagFileName) {
      return sendRequest<TagMeta | undefined>(getComponentMetaRequest, {
        fileName,
        tagName,
        tagFileName,
      } satisfies GetComponentMetaRequestArgs);
    },
  } satisfies MarkoTsServer;
}

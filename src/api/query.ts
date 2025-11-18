import { apiRequest } from "@/api/base.js";

import type { Artifact, ArtifactType } from "@/api/artifacts.js";

export type QueryRequest = {
  query: string;
  limit?: number | null;
  fuzzySearch?: boolean | null;
  vectorSearch?: boolean | null;
  type?: ArtifactType | null;
};

export type QueryResponse = {
  results: Array<Artifact>;
  sources: {
    keywordSearch: Array<Artifact>;
    fuzzySearch: Array<Artifact>;
    vectorSearch: Array<Artifact>;
  };
};

export const queryApi = {
  search: async (args: QueryRequest): Promise<QueryResponse> => {
    const { query, limit, fuzzySearch, vectorSearch, type } = args;

    return apiRequest<QueryResponse>({
      path: "/query",
      method: "POST",
      body: {
        query,
        limit,
        fuzzySearch,
        vectorSearch,
        type,
        actor: "claude-code", // MCP always acts as agent
      },
    });
  },
};

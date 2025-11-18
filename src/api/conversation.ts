import { apiRequest } from "@/api/base.js";

export type SummarizeRequest = {
  content: string;
  actor?: "claude-code";
};

export type SummarizeResponse = {
  summary: string;
  title: string;
  transcriptId: string;
  summaryId: string;
};

export const conversationApi = {
  summarize: async (args: SummarizeRequest): Promise<SummarizeResponse> => {
    const { content } = args;

    return apiRequest<SummarizeResponse>({
      path: "/conversation/summarize",
      method: "POST",
      body: {
        content,
        actor: "claude-code", // MCP always acts as claude-code
      },
    });
  },
};

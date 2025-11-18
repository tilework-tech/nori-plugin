import { apiRequest } from "@/api/base.js";

export type FeedbackItem = {
  category: "good" | "warning" | "critical";
  message: string;
};

export type AnalyzePromptRequest = {
  prompt: string;
};

export type AnalyzePromptResponse = {
  feedback: Array<FeedbackItem>;
};

export const promptAnalysisApi = {
  analyze: async (
    args: AnalyzePromptRequest,
  ): Promise<AnalyzePromptResponse> => {
    const { prompt } = args;

    return apiRequest<AnalyzePromptResponse>({
      path: "/prompt-analysis",
      method: "POST",
      body: {
        prompt,
      },
    });
  },
};

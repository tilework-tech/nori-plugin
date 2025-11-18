import { analyticsApi } from "@/api/analytics.js";
import { artifactsApi } from "@/api/artifacts.js";
import { apiRequest } from "@/api/base.js";
import { conversationApi } from "@/api/conversation.js";
import { heartbeatsApi } from "@/api/heartbeats.js";
import { noridocsApi } from "@/api/noridocs.js";
import { promptAnalysisApi } from "@/api/promptAnalysis.js";
import { queryApi } from "@/api/query.js";
import { webhookRequestsApi } from "@/api/webhookRequests.js";
import { webhooksApi } from "@/api/webhooks.js";

/**
 * Response from handshake endpoint
 */
export type HandshakeResponse = {
  success: boolean;
  user: string;
  message: string;
};

/**
 * Test authentication with server
 * @returns Handshake response with user info
 */
export const handshake = async (): Promise<HandshakeResponse> => {
  return await apiRequest<HandshakeResponse>({
    path: "/auth/handshake",
    method: "POST",
  });
};

export const apiClient = {
  analytics: analyticsApi,
  artifacts: artifactsApi,
  conversation: conversationApi,
  heartbeats: heartbeatsApi,
  noridocs: noridocsApi,
  promptAnalysis: promptAnalysisApi,
  query: queryApi,
  webhooks: webhooksApi,
  webhookRequests: webhookRequestsApi,
  handshake,
};

export type {
  GenerateDailyReportRequest,
  GenerateDailyReportResponse,
  GenerateUserReportRequest,
  GenerateUserReportResponse,
} from "@/api/analytics.js";
export type { Artifact, ReplaceInArtifactRequest } from "@/api/artifacts.js";
export type { Heartbeat, ListHeartbeatsParams } from "@/api/heartbeats.js";
export type { QueryResponse, QueryRequest } from "@/api/query.js";
export type {
  SummarizeRequest,
  SummarizeResponse,
} from "@/api/conversation.js";
export type {
  AnalyzePromptRequest,
  AnalyzePromptResponse,
  FeedbackItem,
} from "@/api/promptAnalysis.js";
export type { Webhook } from "@/api/webhooks.js";
export type { WebhookRequest } from "@/api/webhookRequests.js";
export type {
  Noridoc,
  NoridocVersion,
  CreateNoridocRequest,
  UpdateNoridocRequest,
  ListNoridocsRequest,
  ListVersionsRequest,
} from "@/api/noridocs.js";
export { ConfigManager } from "@/api/base.js";

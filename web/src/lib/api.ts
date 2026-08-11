import axios from "axios";
import { authClient } from "#/lib/auth-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface ChatMessagePayload {
  sender: "user" | "assistant";
  content: string;
}

export interface LangGraphMessage {
  content: string;
  type: string;
  id?: string;
  [key: string]: any;
}

export interface LangGraphResponse {
  messages: LangGraphMessage[];
}

export async function sendChatMessage(
  conversation: ChatMessagePayload[],
  chatId: string,
  userId = 1,
  studentCode = ""
): Promise<LangGraphResponse> {
  const tokenRes = await authClient.convex.token();
  const token = tokenRes.data?.token;

  const response = await axios.post<LangGraphResponse>(
    `${BACKEND_URL}/chat`,
    {
      user_id: userId,
      chat_id: chatId,
      conversation,
      student_code: studentCode,
    },
    {
      timeout: 60000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
}

export interface ScratchpadRunResult {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: number;
  status?: { id: number; description: string };
  status_id?: number;
}

export async function scratchpadExecute(
  code: string,
  languageId = 71,
  stdin = ""
): Promise<ScratchpadRunResult> {
  const tokenRes = await authClient.convex.token();
  const token = tokenRes.data?.token;

  const response = await axios.post<ScratchpadRunResult>(
    `${BACKEND_URL}/scratchpad/execute`,
    {
      code,
      language_id: languageId,
      stdin: stdin || undefined,
    },
    {
      timeout: 30000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
}

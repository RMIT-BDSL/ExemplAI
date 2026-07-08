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
  userId = 1,
  studentCode = ""
): Promise<LangGraphResponse> {
  const tokenRes = await authClient.convex.token();
  const token = tokenRes.data?.token;

  const response = await axios.post<LangGraphResponse>(
    `${BACKEND_URL}/chat`,
    {
      user_id: userId,
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

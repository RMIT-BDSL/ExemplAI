import axios from "axios";

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
  userId = 1
): Promise<LangGraphResponse> {
  const response = await axios.post<LangGraphResponse>(`${BACKEND_URL}/chat`, {
    user_id: userId,
    conversation,
  }, {
    timeout: 60000
  });
  return response.data;
}

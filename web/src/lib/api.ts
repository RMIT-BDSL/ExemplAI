import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface ChatMessagePayload {
  sender: "user" | "assistant";
  content: string;
}

export async function sendChatMessage(
  conversation: ChatMessagePayload[],
  userId = 1,
): Promise<string> {
  const response = await axios.post<{ response: string }>(`${BACKEND_URL}/chat`, {
    user_id: userId,
    conversation,
  });
  return response.data.response;
}

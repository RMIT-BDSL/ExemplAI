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
  studentCode = "",
  // "get_help" / "new_example": the chat buttons (server forces a new example).
  trigger: "message" | "get_help" | "new_example" = "message"
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
      trigger,
    },
    {
      timeout: 60000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return response.data;
}

/** Judge0's raw result for an ungraded run (see server run_scratchpad). */
export interface ScratchpadRunResult {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  /** Seconds, as a string, e.g. "0.012". */
  time?: string | null;
  status?: { id: number; description: string };
}

// Runs a snippet as-is: no test cases, no grading, no lesson progress.
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

/** How long the chat waits for the tutor before giving up (also shown to students). */
export const CHAT_TIMEOUT_MS = 60_000;

/**
 * Like sendChatMessage, but through POST /chat/stream: `onStep` is called with
 * each graph step as it finishes ("input_guardrail", an agent node,
 * "dean_validation_node"), so the chat can show real progress while the
 * student waits. The reply itself still renders from Convex. Rejects on an
 * HTTP or server error event, so callers keep the same recovery path.
 */
export async function streamChatMessage(
  conversation: ChatMessagePayload[],
  chatId: string,
  userId = 1,
  studentCode = "",
  trigger: "message" | "get_help" | "new_example" = "message",
  onStep: (node: string) => void = () => {}
): Promise<void> {
  const tokenRes = await authClient.convex.token();
  const token = tokenRes.data?.token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKEND_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user_id: userId,
        chat_id: chatId,
        conversation,
        student_code: studentCode,
        trigger,
      }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`Chat stream failed (${response.status})`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const raw of events) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const event = JSON.parse(line.slice(5).trim());
        if (event.type === "step") onStep(event.node);
        else if (event.type === "error") throw new Error(event.message ?? "Chat error");
        else if (event.type === "done") return;
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

import { useMutation, useQuery } from "convex/react";
import * as React from "react";
import {
  CHAT_TIMEOUT_MS,
  ChatServerError,
  streamChatMessage,
} from "#/lib/api.ts";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Message } from "./ChatBox";

export type ExampleTrigger = "get_help" | "new_example";

// The student turn the Get help button adds to the conversation.
export const GET_HELP_MESSAGE =
  "Please provide me an example to help me with this";
// Shown when the tutor hasn't replied within the limit.
const TIMEOUT_MESSAGE = `The tutor didn't reply within ${CHAT_TIMEOUT_MS / 1000} seconds. Please send your message again.`;
// The student turn the New example button adds.
export const NEW_EXAMPLE_MESSAGE = "Please show me a different example";

// The tutor conversation for one lesson, shared by the course chat (ChatBox)
// and the Solve workspace.
// The chat is locked until the student has a failed Submit on the lesson; then
// "Get help" asks the tutor for a first example, after which the student can
// type. Further examples come from "New example", each earned by another failed
// Submit, up to the lesson cap (convex/examples.ts). Convex (addMessage) and
// the server enforce the same rules. The control group gets a plain chat
// instead: open from the start, no example buttons (convex/experiment.ts).
export function useTutorChat({
  editorRef,
  currentCode,
  lessonId,
  onExampleRequested,
}: {
  editorRef?: React.MutableRefObject<any>;
  currentCode?: string;
  lessonId?: string;
  onExampleRequested?: (trigger: ExampleTrigger, examplesUsed: number) => void;
}) {
  // Graph steps finished for the reply being written (from /chat/stream).
  const [progress, setProgress] = React.useState<string[]>([]);
  const [isTyping, setIsTyping] = React.useState(false);
  // The reply being waited for is a new example (shows the example wait lines).
  const [waitingForExample, setWaitingForExample] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // When the POST /chat connection dies (e.g. Firefox NS_BINDING_ERROR, a reset
  // tunnel, or a malformed response) the assistant reply is usually still
  // persisted to Convex by the backend and arrives through `dbMessages` a moment
  // later. While `awaitingReply` is set we hold the typing indicator and wait
  // for that reply instead of showing a hard error right away.
  const [awaitingReply, setAwaitingReply] = React.useState(false);
  const assistantCountRef = React.useRef(0);
  const replyBaselineRef = React.useRef(0);
  // When the current message was sent, for the time limit.
  const sentAtRef = React.useRef(0);
  // Stays true from a failed send until its reply lands (or the next send).
  // Outlives `awaitingReply` so a reply that arrives *after* we've shown the
  // timeout error still retracts that error.
  const expectingReplyRef = React.useRef(false);

  // Convex integration
  const convexLessonId = lessonId as Id<"questions"> | undefined;

  // A fresh chat each time the lesson is opened: the student only ever sees
  // this chat; earlier ones stay in Convex for research.
  const [chatId, setChatId] = React.useState<string | null>(null);
  // The chat a send belongs to; a reply or error that arrives after the chat
  // changed (lesson or group switch) is ignored.
  const chatIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);
  const startChat = useMutation(api.chats.startChat);
  const addMessageMutation = useMutation(api.chats.addMessage);

  // The student's study group (assigned by startChat on their first lesson).
  const myCondition = useQuery(api.experiment.getMyCondition);
  const condition = myCondition?.condition ?? null;
  const isControl = condition === "control";

  // Messages of the current chat only (reactive).
  const dbMessages = useQuery(
    api.chats.getChatMessages,
    chatId ? { chatId: chatId as Id<"chats"> } : "skip",
  );
  // Example allowance: per lesson (carries over when the lesson is reopened);
  // "help started" is per chat, so a fresh chat starts locked.
  const allowance = useQuery(
    api.examples.getExampleAllowance,
    convexLessonId
      ? {
          lessonId: convexLessonId,
          ...(chatId ? { chatId: chatId as Id<"chats"> } : {}),
        }
      : "skip",
  );
  const used = allowance?.used ?? 0;
  const remaining = allowance?.remaining ?? 0;
  const exhausted = allowance?.exhausted ?? false;

  // Convex messages in the local Message format, plus the error line if any.
  const messages: Message[] = React.useMemo(() => {
    const result: Message[] = (dbMessages ?? []).map((msg) => ({
      id: msg._id,
      sender: msg.sender as "user" | "assistant",
      content: msg.content,
      timestamp: new Date(msg._creationTime),
      responseType: msg.response_type,
    }));
    if (localError) {
      result.push({
        id: "local-error",
        sender: "assistant",
        content: localError,
        timestamp: new Date(),
      });
    }
    return result;
  }, [dbMessages, localError]);

  // Track how many assistant messages Convex currently holds so a failed POST
  // /chat can tell whether the reply landed anyway.
  const assistantCount = React.useMemo(
    () => (dbMessages ?? []).filter((m) => m.sender === "assistant").length,
    [dbMessages],
  );
  React.useEffect(() => {
    assistantCountRef.current = assistantCount;
  }, [assistantCount]);

  // Help starts with the tutor's first reply (to Get help); typing unlocks then.
  // The control group's chat is open from the start.
  const helpStarted = isControl || assistantCount > 0;
  // Get help gives a round's first example; New example the rest.
  const canGetHelp = !isControl && used === 0 && remaining > 0;
  const canNewExample = !isControl && used > 0 && remaining > 0;
  // One plain line about what to do next; counts and limits stay out of view.
  const exampleStatus = exhausted
    ? "You've used this lesson's examples. Try a lesson on another topic, then come back for more."
    : used === 0 && !canGetHelp
      ? "Help unlocks after a Submit that doesn't pass."
      : used > 0 && !canNewExample
        ? "Try another submit to unlock the next example."
        : null;
  // A reply landed in Convex for a send whose HTTP call failed — clear the
  // waiting state (and any timeout error we may have already shown). Runs
  // whenever the message list grows, regardless of `awaitingReply`.
  React.useEffect(() => {
    if (!expectingReplyRef.current) return;
    if (assistantCount > replyBaselineRef.current) {
      expectingReplyRef.current = false;
      setAwaitingReply(false);
      setIsTyping(false);
      setLocalError(null);
    }
  }, [assistantCount]);

  // The connection failed early: the reply may still land in Convex, so wait
  // for it, but only until the time limit from sending. A late reply still
  // clears the error via the effect above.
  React.useEffect(() => {
    if (!awaitingReply) return;
    const left = Math.max(
      0,
      CHAT_TIMEOUT_MS - (Date.now() - sentAtRef.current),
    );
    const timer = setTimeout(() => {
      setAwaitingReply(false);
      setIsTyping(false);
      setLocalError(TIMEOUT_MESSAGE);
    }, left);
    return () => clearTimeout(timer);
  }, [awaitingReply]);

  React.useEffect(() => {
    setChatId(null);
    // A new chat starts clean: no waiting state carried over from the last one.
    setIsTyping(false);
    setAwaitingReply(false);
    setLocalError(null);
    setProgress([]);
    expectingReplyRef.current = false;
    let isActive = true;

    async function initChat() {
      if (convexLessonId) {
        try {
          const id = await startChat({ lessonId: convexLessonId });
          if (isActive) {
            setChatId(id);
          }
        } catch (e) {
          if (isActive) {
            console.error("Failed to initialize chat:", e);
          }
        }
      }
    }
    initChat();

    return () => {
      isActive = false;
    };
    // `condition` too: when the testing toggle changes the group, startChat
    // opens a chat for the new group.
  }, [convexLessonId, startChat, condition]);

  // `onSaved` gets the student turn's id once Convex has it.
  const sendMessage = async (
    text: string,
    trigger?: ExampleTrigger,
    onSaved?: (messageId: string) => void,
  ) => {
    if (!chatId || !convexLessonId) return;

    // Optmistically show typing state
    sentAtRef.current = Date.now();
    setWaitingForExample(!!trigger);
    setIsTyping(true);
    setLocalError(null);
    expectingReplyRef.current = false;

    try {
      // 1. Add User Message to Convex
      const saved = await addMessageMutation({
        chatId: chatId as Id<"chats">,
        sender: "user",
        content: text,
        ...(trigger ? { trigger } : {}),
      });
      onSaved?.(saved.id);

      // Prepare conversation payload for backend
      // Note: We use the existing messages array from the UI + the new message
      const conversationPayload = [
        ...messages,
        { sender: "user" as const, content: text },
      ];

      // Extract Monaco editor state
      let editorContext = "";
      let code = currentCode || "";
      let cursorLine = null;
      let cursorColumn = null;
      let selectedText = "";

      if (editorRef?.current) {
        const editor = editorRef.current;
        const editorValue = editor.getValue();
        if (editorValue) {
          code = editorValue;
        }

        const selection = editor.getSelection();
        const position = editor.getPosition();

        if (selection && !selection.isEmpty()) {
          selectedText = editor.getModel()?.getValueInRange(selection) || "";
        }

        if (position) {
          cursorLine = position.lineNumber;
          cursorColumn = position.column;
        }
      }

      if (code) {
        editorContext = `Code:\n${code}\n`;
        if (cursorLine !== null && cursorColumn !== null) {
          editorContext += `Cursor Line: ${cursorLine}, Column: ${cursorColumn}\n`;
        }
        if (selectedText) {
          editorContext += `Selected Text:\n${selectedText}\n`;
        }
      }

      // The response body is intentionally unused: the backend persists the
      // assistant reply to Convex and it renders from the reactive `dbMessages`
      // query. This POST just triggers the run.
      setProgress([]);
      await streamChatMessage(
        conversationPayload,
        chatId,
        1,
        editorContext,
        trigger ?? "message",
        (node) => {
          if (chatIdRef.current === chatId)
            setProgress((prev) => [...prev, node]);
        },
      );
      if (chatIdRef.current === chatId) setIsTyping(false);
    } catch (error) {
      console.error("Error communicating with chat server:", error);
      if (chatIdRef.current !== chatId) return;
      if (error instanceof ChatServerError) {
        // The server answered with an error: no reply is coming, so say why now
        // instead of waiting out the limit.
        setIsTyping(false);
        setLocalError(
          `The tutor couldn't reply (${error.message}). Please send your message again.`,
        );
        return;
      }
      // Timed out or the connection dropped. The graph may still have saved a
      // reply to Convex; a late one clears the message (see the effects above).
      replyBaselineRef.current = assistantCountRef.current;
      expectingReplyRef.current = true;
      if (error instanceof DOMException && error.name === "AbortError") {
        // Hit the time limit: say so now.
        setIsTyping(false);
        setLocalError(TIMEOUT_MESSAGE);
      } else {
        setAwaitingReply(true);
      }
    }
  };

  const exampleTrigger: ExampleTrigger =
    used === 0 ? "get_help" : "new_example";
  const exampleEnabled =
    (exampleTrigger === "get_help" ? canGetHelp : canNewExample) &&
    !!chatId &&
    !!convexLessonId;

  const requestExample = (
    trigger: ExampleTrigger,
    onSaved?: (messageId: string) => void,
  ) => {
    const allowed = trigger === "get_help" ? canGetHelp : canNewExample;
    if (!allowed || isTyping) return null;
    onExampleRequested?.(trigger, used);
    // In a fresh chat the button reads Get help even when it fetches the
    // lesson's next example, so the student's turn says so too.
    return sendMessage(
      trigger === "get_help" || !helpStarted
        ? GET_HELP_MESSAGE
        : NEW_EXAMPLE_MESSAGE,
      trigger,
      onSaved,
    );
  };

  return {
    /** The chat's turns (oldest first), ending with the error line if any. */
    messages,
    /** False until the chat's messages have loaded. */
    loaded: dbMessages !== undefined,
    isTyping,
    progress,
    waitingForExample,
    /** The chat and lesson are known, so messages can be sent. */
    ready: !!chatId && !!convexLessonId,
    isControl,
    helpStarted,
    remaining,
    exhausted,
    canGetHelp,
    canNewExample,
    exampleStatus,
    exampleTrigger,
    exampleEnabled,
    sendMessage,
    requestExample,
  };
}

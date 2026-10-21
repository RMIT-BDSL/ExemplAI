// Chat message limits, shared by the chat box and Convex (chats.addMessage).
//
// A cap on what one typed message can send to the tutor, so a pasted essay or
// file can't run up model cost. Longer messages are cut to the cap, not
// refused. The tutor server reads the conversation from Convex, so the cap in
// addMessage covers it too.

export const MAX_CHAT_MESSAGE_CHARS = 4000;

export function capChatMessage(content: string): string {
  return content.slice(0, MAX_CHAT_MESSAGE_CHARS);
}

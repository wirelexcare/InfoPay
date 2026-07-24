import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

export type ChatRealtimeEvent =
  | { type: "messages-changed" }
  | { type: "lock-changed" }
  | { type: "typing"; adminName: string; isTyping: boolean };

// Subscribes to broadcast-only signals for a thread (no message content ever
// travels over this channel — see backend/src/lib/realtime.ts). Returns an
// unsubscribe function.
export function subscribeToChatThread(
  threadUserId: string,
  onEvent: (event: ChatRealtimeEvent) => void,
): () => void {
  const channel = supabase
    .channel(`chat-thread-${threadUserId}`)
    .on("broadcast", { event: "messages-changed" }, (msg) =>
      onEvent(msg.payload as ChatRealtimeEvent),
    )
    .on("broadcast", { event: "lock-changed" }, (msg) =>
      onEvent(msg.payload as ChatRealtimeEvent),
    )
    .on("broadcast", { event: "typing" }, (msg) =>
      onEvent(msg.payload as ChatRealtimeEvent),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not set");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Broadcast payloads are signals only ("something changed", "so-and-so is
// typing") — never message content — so a client that guesses another
// thread's channel name learns nothing sensitive. Actual content is always
// fetched back through the authenticated REST endpoints.
export type ChatRealtimeEvent =
  | { type: "messages-changed" }
  | { type: "lock-changed" }
  | { type: "typing"; adminName: string; isTyping: boolean };

function channelForThread(threadUserId: string) {
  return supabase.channel(`chat-thread-${threadUserId}`);
}

export async function publishChatEvent(
  threadUserId: string,
  event: ChatRealtimeEvent,
) {
  const channel = channelForThread(threadUserId);
  await channel.send({
    type: "broadcast",
    event: event.type,
    payload: event,
  });
  await supabase.removeChannel(channel);
}

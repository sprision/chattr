import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChatRoomProps {
  room: any;
  user: any;
}

const ChatRoom = ({ room, user }: ChatRoomProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    joinRoom();
    subscribeToMessages();

    return () => {
      leaveRoom();
    };
  }, [room.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select(`
        *,
        profiles:user_id(username, avatar_url)
      `)
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) setMessages(data);
  };

  const joinRoom = async () => {
    await supabase.from("room_members").upsert({
      room_id: room.id,
      user_id: user.id,
      last_seen: new Date().toISOString()
    });
  };

  const leaveRoom = async () => {
    await supabase.from("room_members").upsert({
      room_id: room.id,
      user_id: user.id,
      last_seen: new Date().toISOString()
    });
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${room.id}`
        },
        async (payload) => {
          const { data: messageWithProfile } = await supabase
            .from("messages")
            .select(`
              *,
              profiles:user_id(username, avatar_url)
            `)
            .eq("id", payload.new.id)
            .single();

          if (messageWithProfile) {
            setMessages(prev => [...prev, messageWithProfile]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        room_id: room.id,
        user_id: user.id,
        content: newMessage.trim(),
        is_bot: false
      });

      if (error) throw error;

      setNewMessage("");

      // Trigger AI bot response (disabled by default; enable via VITE_ENABLE_BOT=true)
      if (import.meta.env.VITE_ENABLE_BOT === "true") {
        setTimeout(async () => {
          await supabase.functions.invoke("chat-bot", {
            body: {
              roomId: room.id,
              roomTopic: room.interests?.name,
              userMessage: newMessage.trim()
            }
          });
        }, 1000);
      }

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{room.interests?.icon}</span>
          <div>
            <h2 className="text-xl font-bold">{room.name}</h2>
            <p className="text-sm text-muted-foreground">{room.description}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 animate-slide-in ${
                message.user_id === user.id ? "flex-row-reverse" : ""
              }`}
            >
              {message.is_bot ? (
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {message.profiles?.username?.[0]?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
              
              <div
                className={`flex-1 max-w-xl ${
                  message.user_id === user.id ? "text-right" : ""
                }`}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span
                    className={`text-sm font-semibold ${
                      message.is_bot ? "" : "text-yellow-400"
                    }`}
                  >
                    {message.is_bot
                      ? "AI Bot"
                      : message.user_id === user.id
                      ? "You"
                      : message.profiles?.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.created_at), "HH:mm")}
                  </span>
                </div>
                <div
                  className={`inline-block p-3 rounded-2xl ${
                    message.user_id === user.id
                      ? "bg-[hsl(var(--chat-bubble-user))] text-yellow-400"
                      : message.is_bot
                      ? "bg-accent/10 text-accent-foreground border border-accent/20"
                      : "bg-[hsl(var(--chat-bubble-other))] text-yellow-400"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-card">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;
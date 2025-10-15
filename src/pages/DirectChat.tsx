import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { toast } from "sonner";

const DirectChat = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
    })();
  }, []);

  useEffect(() => {
    if (!roomId) return;
    loadRoom();
    loadMessages();
    const unsubscribe = subscribeToMessages();
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadRoom = async () => {
    const { data, error } = await supabase
      .from("dm_rooms")
      .select("*, user_a:profiles!dm_rooms_user_a_id_fkey(username, avatar_url), user_b:profiles!dm_rooms_user_b_id_fkey(username, avatar_url)")
      .eq("id", roomId)
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setRoom(data);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("dm_messages")
      .select("*, sender:profiles!dm_messages_sender_id_fkey(username, avatar_url)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`dm:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data } = await supabase
            .from("dm_messages")
            .select("*, sender:profiles!dm_messages_sender_id_fkey(username, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (data) setMessages(prev => [...prev, data]);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.from("dm_messages").insert({
      room_id: roomId,
      sender_id: user.id,
      content: newMessage.trim()
    });
    if (error) toast.error(error.message);
    else setNewMessage("");
    setSending(false);
  };

  const otherUsername = (() => {
    if (!room || !user) return "";
    const isA = room.user_a_id === user.id;
    return isA ? room.user_b?.username : room.user_a?.username;
  })();

  return (
    <div className="flex h-screen flex-col">
      <div className="p-4 border-b border-border bg-card">
        <h2 className="text-xl font-bold">
          Direct chat with <span className="text-yellow-400">{otherUsername || "Friend"}</span>
        </h2>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.sender_id === user?.id ? "flex-row-reverse" : ""}`}>
              <div className={`inline-block p-3 rounded-2xl ${m.sender_id === user?.id ? "bg-[hsl(var(--chat-bubble-user))] text-yellow-400" : "bg-[hsl(var(--chat-bubble-other))] text-yellow-400"}`}>
                <p className="text-sm">{m.content}</p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border bg-card">
        <form onSubmit={handleSend} className="flex gap-2 max-w-3xl mx-auto">
          <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." disabled={sending} className="flex-1" />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DirectChat;



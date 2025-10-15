import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LogOut, MessageCircle, User, Users, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ChatSidebarProps {
  user: any;
  selectedRoom: any;
  onSelectRoom: (room: any) => void;
}

const ChatSidebar = ({ user, selectedRoom, onSelectRoom }: ChatSidebarProps) => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; created_at: string }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "groups">("all");

  useEffect(() => {
    loadRooms();
    subscribeToPresence();
  }, [user]);

  const loadRooms = async () => {
    // Get user's interests
    const { data: userInterests } = await supabase
      .from("user_interests")
      .select("interest_id")
      .eq("user_id", user.id);

    if (!userInterests) return;

    const interestIds = userInterests.map(ui => ui.interest_id);

    // Get rooms for those interests
    const { data: roomsData } = await supabase
      .from("chat_rooms")
      .select("*, interests(name, icon, color)")
      .in("interest_id", interestIds)
      .order("created_at");

    if (roomsData) {
      setRooms(roomsData);
      if (roomsData.length > 0 && !selectedRoom) {
        onSelectRoom(roomsData[0]);
      }
      const results = await Promise.all(
        roomsData.map(async (room: any) => {
          const { data } = await supabase
            .from("messages")
            .select("content, created_at")
            .eq("room_id", room.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return [room.id, data] as const;
        })
      );
      const map: Record<string, { content: string; created_at: string }> = {};
      results.forEach(([roomId, msg]) => {
        if (msg) map[roomId] = { content: msg.content, created_at: msg.created_at } as any;
      });
      setLastMessages(map);
    }
  };

  const subscribeToPresence = () => {
    const channel = supabase.channel("presence");

    rooms.forEach(room => {
      channel.on(
        "presence",
        { event: "sync" },
        () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setOnlineUsers(prev => ({ ...prev, [room.id]: count }));
        }
      );
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  return (
    <div className="w-80 bg-[hsl(var(--sidebar-bg))] border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Chattr</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-card rounded-lg">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{user.profile?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex items-center gap-2">
          <Badge
            variant={activeFilter === "all" ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setActiveFilter("all")}
          >
            All
          </Badge>
          <Badge
            variant={activeFilter === "groups" ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setActiveFilter("groups")}
          >
            Groups
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {rooms
            .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((room) => {
              const last = lastMessages[room.id];
              const time = last ? new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
              const selected = selectedRoom?.id === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${selected ? "bg-primary/10" : "hover:bg-muted"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: room.interests?.color || "#e5e7eb" }}>
                      <span>{room.interests?.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">{room.name}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground truncate">{last?.content || `${onlineUsers[room.id] || 0} online`}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/profile-setup")}
          >
            Edit Profile
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => navigate("/friends")}
          >
            <Users className="w-4 h-4 mr-2" /> Friends
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
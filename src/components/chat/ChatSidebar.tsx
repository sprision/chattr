import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const [activeFilter, setActiveFilter] = useState<"all" | "groups" | "friends">("all");
  const [friends, setFriends] = useState<any[]>([]);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [friendsLoading, setFriendsLoading] = useState(false);

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

  useEffect(() => {
    if (activeFilter === "friends") {
      refreshFriends();
    }
  }, [activeFilter]);

  const refreshFriends = async () => {
    setFriendsLoading(true);
    const { data, error } = await supabase
      .from("friends")
      .select(
        `id, sender_id, receiver_id, status,
         sender:profiles!friends_sender_id_fkey(id, username, avatar_url),
         receiver:profiles!friends_receiver_id_fkey(id, username, avatar_url)`
      )
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq("status", "accepted")
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
      setFriends([]);
      setFriendsLoading(false);
      return;
    }
    const normalized = (data || []).map((row: any) => {
      const other = row.sender_id === user.id ? row.receiver : row.sender;
      return { id: row.id, otherUser: other };
    });
    setFriends(normalized);
    setFriendsLoading(false);
  };

  const sendFriendRequestByUsername = async (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", trimmed)
      .maybeSingle();
    if (!profile) return toast.error("User not found");
    if (profile.id === user.id) return toast.error("You cannot add yourself");

    const { data: existing } = await supabase
      .from("friends")
      .select("id, status")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
      .maybeSingle();
    if (existing?.status === "pending") return toast.message("Request already pending");
    if (existing?.status === "accepted") return toast.message("You are already friends");

    const { error } = await supabase
      .from("friends")
      .insert({ sender_id: user.id, receiver_id: profile.id, status: "pending" });
    if (error) return toast.error(error.message);
    setUsernameQuery("");
    toast.success("Friend request sent");
  };

  const openDirectMessage = async (otherUserId: string) => {
    const { data: existing } = await supabase
      .from("dm_rooms")
      .select("id")
      .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${user.id})`)
      .maybeSingle();
    let roomId = existing?.id;
    if (!roomId) {
      const { data: created, error } = await supabase
        .from("dm_rooms")
        .insert({ user_a_id: user.id, user_b_id: otherUserId })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      roomId = created.id;
    }
    window.location.href = `/dm/${roomId}`;
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
          <Badge
            variant={activeFilter === "friends" ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setActiveFilter("friends")}
          >
            Friends
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        {activeFilter !== "friends" ? (
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
        ) : (
          <div className="space-y-3 p-1">
            <div className="flex gap-2">
              <Input
                placeholder="Search username to add"
                value={usernameQuery}
                onChange={(e) => setUsernameQuery(e.target.value)}
              />
              <Button size="sm" onClick={() => sendFriendRequestByUsername(usernameQuery)} disabled={friendsLoading}>
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {friends.length === 0 && (
                <p className="text-sm text-muted-foreground">No friends yet.</p>
              )}
              {friends.map((f) => (
                <div key={f.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{f.otherUser?.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.otherUser?.username || f.otherUser?.id}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openDirectMessage(f.otherUser?.id)}>
                    Message
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/profile-setup")}
        >
          Edit Profile
        </Button>
      </div>
    </div>
  );
};

export default ChatSidebar;
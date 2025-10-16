import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, MessageCircle, User, ArrowLeft, Camera, MoreVertical, Search } from "lucide-react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatRoom from "@/components/chat/ChatRoom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Friends from "@/features/friends/friends";
import ProfileSetup from "@/pages/ProfileSetup";

const Chat = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"rooms" | "friends">("rooms");
  const [profileOpen, setProfileOpen] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; created_at: string }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "groups">("all");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if profile is set up
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, user_interests(interest_id)")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.user_interests || profile.user_interests.length === 0) {
      navigate("/profile-setup");
      return;
    }

    setUser({ ...user, profile });
    setLoading(false);
    await loadRooms(user.id);
  };

  const loadRooms = async (userId: string) => {
    const { data: userInterests } = await supabase
      .from("user_interests")
      .select("interest_id")
      .eq("user_id", userId);
    if (!userInterests) return;
    const interestIds = userInterests.map((ui: any) => ui.interest_id);
    const { data: roomsData } = await supabase
      .from("chat_rooms")
      .select("*, interests(name, icon, color)")
      .in("interest_id", interestIds)
      .order("created_at");
    if (roomsData) {
      setRooms(roomsData);
      // Fetch last message per room (simple per-room fetch)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-[hsl(var(--chat-bg))]">
        {/* Top App Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="text-2xl font-bold">Chattr</div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Camera className="w-5 h-5" />
            <MoreVertical className="w-5 h-5" />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === "friends" ? (
            <div className="p-3">
              <Friends user={user} />
            </div>
          ) : selectedRoom ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 p-2 border-b border-border bg-background">
                <Button variant="ghost" size="sm" onClick={() => setSelectedRoom(null)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="font-semibold truncate">{selectedRoom?.name}</div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatRoom room={selectedRoom} user={user} />
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto">
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

              {/* Rooms List */}
              <div className="space-y-1">
                {rooms
                  .filter((r) =>
                    r.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .filter((r) => (activeFilter === "groups" ? true : true))
                  .map((room) => {
                    const last = lastMessages[room.id];
                    const time = last ? new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-muted"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: room.interests?.color || "#e5e7eb" }}>
                            <span>{room.interests?.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold truncate text-white">{room.name}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-muted-foreground truncate">{last?.content || ""}</p>
                              {/* Unread badge placeholder */}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                {rooms.length === 0 && (
                  <p className="text-sm text-muted-foreground">No rooms yet. Choose interests in your profile.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Tab Bar */}
        <div className="border-t border-border bg-background px-6 py-2 flex items-center justify-around">
          <button
            className={`flex flex-col items-center text-sm ${activeTab === "rooms" ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("rooms")}
          >
            <MessageCircle className="w-5 h-5" />
            <span>Chats</span>
          </button>
          <button
            className={`flex flex-col items-center text-sm ${activeTab === "friends" ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("friends")}
          >
            <Users className="w-5 h-5" />
            <span>Friends</span>
          </button>
          <button
            className="flex flex-col items-center text-sm text-muted-foreground"
            onClick={() => setProfileOpen(true)}
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </button>
        </div>

        <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
          <SheetContent side="left" className="p-0">
            <SheetHeader className="px-4 py-3 border-b border-border bg-background">
              <SheetTitle>Edit Profile</SheetTitle>
            </SheetHeader>
            <div className="p-3">
              <ProfileSetup />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[hsl(var(--chat-bg))]">
      <ChatSidebar
        user={user}
        selectedRoom={selectedRoom}
        onSelectRoom={setSelectedRoom}
      />
      {selectedRoom ? (
        <ChatRoom room={selectedRoom} user={user} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Select a room to start chatting</p>
        </div>
      )}
    </div>
  );
};

export default Chat;
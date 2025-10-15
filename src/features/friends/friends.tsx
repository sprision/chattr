import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

type FriendRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
};

export default function Friends({ user }: { user: any }) {
  const [friends, setFriends] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshAll();
    const channel = supabase
      .channel("friends-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends", filter: `sender_id=eq.${user.id}` },
        () => refreshAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends", filter: `receiver_id=eq.${user.id}` },
        () => refreshAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function refreshAll() {
    setLoading(true);
    await Promise.all([fetchFriends(), fetchIncoming(), fetchOutgoing()]);
    setLoading(false);
  }

  async function fetchFriends() {
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
      return;
    }

    const normalized = (data || []).map((row: any) => {
      const other = row.sender_id === user.id ? row.receiver : row.sender;
      return { id: row.id, otherUser: other };
    });
    setFriends(normalized);
  }

  async function fetchIncoming() {
    const { data, error } = await supabase
      .from("friends")
      .select(
        `id, sender_id, receiver_id, status,
         sender:profiles!friends_sender_id_fkey(id, username, avatar_url)`
      )
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
      setIncomingRequests([]);
      return;
    }
    setIncomingRequests(data || []);
  }

  async function fetchOutgoing() {
    const { data, error } = await supabase
      .from("friends")
      .select(
        `id, sender_id, receiver_id, status,
         receiver:profiles!friends_receiver_id_fkey(id, username, avatar_url)`
      )
      .eq("sender_id", user.id)
      .eq("status", "pending")
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
      setOutgoingRequests([]);
      return;
    }
    setOutgoingRequests(data || []);
  }

  async function sendFriendRequestByUsername(username: string) {
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
    await fetchOutgoing();
  }

  async function acceptRequest(requestId: string) {
    const { error } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", requestId);
    if (error) return toast.error(error.message);
    toast.success("Friend request accepted");
    await refreshAll();
  }

  async function declineRequest(requestId: string) {
    const { error } = await supabase
      .from("friends")
      .update({ status: "declined" })
      .eq("id", requestId);
    if (error) return toast.error(error.message);
    toast.message("Request declined");
    await refreshAll();
  }

  async function cancelOutgoing(requestId: string) {
    const { error } = await supabase
      .from("friends")
      .delete()
      .eq("id", requestId);
    if (error) return toast.error(error.message);
    toast.message("Request canceled");
    await fetchOutgoing();
  }

  async function openDirectMessage(otherUserId: string) {
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
  }

  const SectionTitle = ({ children }: any) => (
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>
  );

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search username to add"
            value={usernameQuery}
            onChange={(e) => setUsernameQuery(e.target.value)}
          />
          <Button onClick={() => sendFriendRequestByUsername(usernameQuery)} disabled={loading}>
            Add Friend
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <SectionTitle>Friends</SectionTitle>
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
                <Button variant="secondary" onClick={() => openDirectMessage(f.otherUser?.id)}>
                  Message
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="space-y-3">
            <SectionTitle>Incoming Requests</SectionTitle>
            {incomingRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No incoming requests.</p>
            )}
            {incomingRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{r.sender?.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <p className="truncate">{r.sender?.username || r.sender_id}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptRequest(r.id)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => declineRequest(r.id)}>Decline</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <SectionTitle>Outgoing Requests</SectionTitle>
            {outgoingRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No outgoing requests.</p>
            )}
            {outgoingRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{r.receiver?.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <p className="truncate">{r.receiver?.username || r.receiver_id}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => cancelOutgoing(r.id)}>Cancel</Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

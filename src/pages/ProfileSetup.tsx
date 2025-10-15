import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<any[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Load interests
    const { data: interestsData } = await supabase
      .from("interests")
      .select("*")
      .order("name");
    
    if (interestsData) setInterests(interestsData);

    // Check if profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      
      // Load user's interests
      const { data: userInterests } = await supabase
        .from("user_interests")
        .select("interest_id")
        .eq("user_id", user.id);
      
      if (userInterests) {
        setSelectedInterests(userInterests.map(ui => ui.interest_id));
      }
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (selectedInterests.length === 0) {
      toast.error("Please select at least one interest");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ username, bio })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Delete existing interests
      await supabase
        .from("user_interests")
        .delete()
        .eq("user_id", user.id);

      // Insert new interests
      const { error: interestsError } = await supabase
        .from("user_interests")
        .insert(
          selectedInterests.map(interestId => ({
            user_id: user.id,
            interest_id: interestId
          }))
        );

      if (interestsError) throw interestsError;

      toast.success("Profile saved!");
      navigate("/chat");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-2xl p-8 animate-fade-in">
        <h1 className="text-3xl font-bold mb-2">Set Up Your Profile</h1>
        <p className="text-muted-foreground mb-6">
          Tell us about yourself and choose your interests
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a unique username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Select Your Interests (choose at least one)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {interests.map((interest) => (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedInterests.includes(interest.id)
                      ? "border-primary bg-primary/10 scale-105"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="text-3xl mb-1">{interest.icon}</div>
                  <div className="font-semibold">{interest.name}</div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || selectedInterests.length === 0}
            className="w-full"
          >
            {saving ? "Saving..." : "Save & Continue to Chat"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfileSetup;
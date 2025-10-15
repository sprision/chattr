import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // After login, decide destination based on profile completeness
        const { data: userResponse } = await supabase.auth.getUser();
        const user = userResponse?.user;

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, username, bio")
            .eq("id", user.id)
            .single();

          const { data: userInterests } = await supabase
            .from("user_interests")
            .select("interest_id")
            .eq("user_id", user.id);

          const hasAtLeastOneInterest = Array.isArray(userInterests) && userInterests.length > 0;
          const hasUsername = !!profile?.username && profile.username.trim().length > 0;

          toast.success("Welcome back!");
          if (hasUsername && hasAtLeastOneInterest) {
            navigate("/chat");
          } else {
            navigate("/profile-setup");
          }
        } else {
          toast.success("Welcome back!");
          navigate("/profile-setup");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${window.location.origin}/profile-setup`,
          },
        });
        if (error) throw error;
        if (data.user) {
          toast.success("Account created! Setting up your profile...");
          navigate("/profile-setup");
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md p-8 animate-fade-in">
        <div className="flex items-center justify-center mb-6">
          <MessageCircle className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">Chattr</h1>
        <p className="text-center text-muted-foreground mb-8">
          Connect through shared interests
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required={!isLogin}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <p className="text-center mt-4 text-sm text-muted-foreground">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </Card>
    </div>
  );
};

export default Auth;
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Sparkles, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16 animate-fade-in">
          <div className="flex justify-center mb-6">
            <MessageCircle className="w-20 h-20 text-primary" />
          </div>
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Welcome to Chattr
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect instantly with people who share your passions. Real-time chat rooms for gaming, music, coding, and more.
          </p>
          <Button onClick={() => navigate("/auth")} size="lg" className="text-lg px-8">
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary transition-all hover:scale-105 animate-fade-in">
            <Users className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Interest-Based Rooms</h3>
            <p className="text-muted-foreground">
              Join chat rooms tailored to your interests. Find your community instantly.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary transition-all hover:scale-105 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <Zap className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Real-Time Chat</h3>
            <p className="text-muted-foreground">
              Experience lightning-fast messaging with instant delivery and online presence.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary transition-all hover:scale-105 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Sparkles className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">AI Companion</h3>
            <p className="text-muted-foreground">
              Never chat alone. Our friendly AI bot keeps conversations flowing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

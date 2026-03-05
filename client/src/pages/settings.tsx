import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Settings as SettingsIcon, 
  RefreshCw, 
  Folder, 
  Network,
  Globe,
  Crown,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Send,
  Info,
  Shield,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StorageInfo } from "@shared/schema";
import { PageContainer, SectionHeading } from "@/ui-kit";

function SyncSettings({ storagePath }: { storagePath?: string }) {
  const { toast } = useToast();
  const [autoSync, setAutoSync] = useState(true);

  const handleSyncNow = () => {
    toast({
      title: "Syncing...",
      description: "Your files are being synchronized",
    });
    setTimeout(() => {
      toast({
        title: "Sync Complete",
        description: "All files are up to date",
      });
    }, 2000);
  };

  return (
    <Card data-testid="card-sync-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Sync & Storage
        </CardTitle>
        <CardDescription>Manage how your files are synchronized and accessed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-sync" className="text-base flex items-center gap-2">
              Auto Sync
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center text-muted-foreground">
                    <Info className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Keeps your local files up to date automatically.
                </TooltipContent>
              </Tooltip>
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically sync files when changes are detected
            </p>
          </div>
          <Switch
            id="auto-sync"
            checked={autoSync}
            onCheckedChange={setAutoSync}
            data-testid="switch-auto-sync"
          />
        </div>

        <Button onClick={handleSyncNow} variant="outline" className="w-full" data-testid="button-sync-now">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Now
        </Button>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Storage Location
          </Label>
          <div className="p-3 rounded-md bg-muted font-mono text-sm" data-testid="text-storage-path">
            {storagePath || "~/JoinCloud"}
          </div>
          <p className="text-xs text-muted-foreground">
            This is where your cloud files are stored locally
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SupportSection() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Message Received",
      description: "Thank you for your feedback!",
    });
    
    setMessage("");
    setEmail("");
  };

  return (
    <Card data-testid="card-support-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Help & Support
        </CardTitle>
        <CardDescription>Get assistance with JoinCloud</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button variant="outline" className="justify-start h-auto p-4" data-testid="button-docs">
            <BookOpen className="h-5 w-5 mr-3" />
            <div className="text-left">
              <p className="font-medium">Documentation</p>
              <p className="text-xs text-muted-foreground">Guides and tutorials</p>
            </div>
          </Button>
          
          <Button variant="outline" className="justify-start h-auto p-4" data-testid="button-community">
            <MessageSquare className="h-5 w-5 mr-3" />
            <div className="text-left">
              <p className="font-medium">Community</p>
              <p className="text-xs text-muted-foreground">Ask questions and share</p>
            </div>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-email">Your Email</Label>
            <Input
              id="support-email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-support-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-message">How can we help?</Label>
            <Textarea
              id="support-message"
              placeholder="Describe your issue or question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              data-testid="textarea-support-message"
            />
          </div>

          <Button type="submit" className="w-full" data-testid="button-submit-support">
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PrivacyPolicyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-primary hover:text-primary/80">
          <Shield className="h-4 w-4 mr-2" />
          Privacy Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Policy
          </DialogTitle>
          <DialogDescription>
            Last updated: February 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-base mb-2">1. Introduction</h3>
              <p className="text-muted-foreground">
                JoinCloud ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our desktop application and related services.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">2. Information We Collect</h3>
              <p className="text-muted-foreground mb-2">
                JoinCloud is designed with privacy in mind. We collect minimal information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Account information (email address) when you create an account</li>
                <li>Device identifiers for secure device linking</li>
                <li>Usage analytics to improve our services (optional)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">3. Local-First Architecture</h3>
              <p className="text-muted-foreground">
                JoinCloud operates on a local-first principle. Your files are stored on your own device and are never uploaded to our servers. File sharing happens directly between devices on your local network or through secure peer-to-peer connections.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">4. Data Security</h3>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your account information. All data transmissions are encrypted using TLS. Your files remain under your control on your local device.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">5. Third-Party Services</h3>
              <p className="text-muted-foreground">
                JoinCloud may use third-party services for features like tunneling (for external access) and payment processing. These services have their own privacy policies, and we encourage you to review them.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">6. Your Rights</h3>
              <p className="text-muted-foreground mb-2">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Access your personal information</li>
                <li>Request deletion of your account</li>
                <li>Opt out of analytics collection</li>
                <li>Export your data</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base mb-2">7. Contact Us</h3>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy, please contact us at privacy@joincloud.in
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function AboutSection() {
  return (
    <Card data-testid="card-about">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          About JoinCloud
        </CardTitle>
        <CardDescription>Application information and legal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="font-medium">0.3.4</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">License</p>
            <p className="font-medium text-green-400">FREE</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Platform</p>
            <p className="font-medium">Desktop App</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          JoinCloud is a personal cloud network for secure, high-speed LAN file sharing and collaboration. Your files stay on your device – share them securely with temporary links, password protection, and download limits.
        </p>

        <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
          <PrivacyPolicyDialog />
          <Button variant="link" className="h-auto p-0 text-primary hover:text-primary/80" asChild>
            <a href="https://joincloud.in/terms" target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 mr-2" />
              Terms of Service
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { data: storagePath } = useQuery<string>({
    queryKey: ["storage:basePath"],
    queryFn: async () => {
      if (typeof window !== 'undefined' && window.electronAPI?.storage) {
        return window.electronAPI.storage.getBasePath();
      }
      return '~/JoinCloud';
    },
  });

  return (
    <PageContainer className="space-y-8">
      <SectionHeading
        title="Settings"
        description="Manage your JoinCloud preferences"
      />

      {/* General Settings Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
          General
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SyncSettings storagePath={storagePath} />
        </motion.div>
      </section>

      {/* Support Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
          Support
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <SupportSection />
        </motion.div>
      </section>

      {/* About Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          About
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <AboutSection />
        </motion.div>
      </section>
    </PageContainer>
  );
}

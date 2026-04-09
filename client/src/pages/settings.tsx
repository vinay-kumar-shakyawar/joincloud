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

const PRIVACY_POLICY_TEXT = `JoinCloud Privacy Policy
Effective Date: April 8, 2026
Application Version: v0.3.6 (Beta)
Website: https://www.joincloud.cloud
Shakyawar Mediatech LLP ("we", "our", or "us") operates the JoinCloud platform at https://www.joincloud.cloud. This Privacy Policy explains how we collect, use, and protect information when you use our service. By using JoinCloud, you agree to this policy.
1. Who We Are
JoinCloud is a file sharing platform operated by Shakyawar Mediatech LLP. Marketing activities are supported by our partner Arevei.com. JoinCloud enables users to share files directly from their own Host Device across three modes: File Sharing via LAN, File Sharing via Remote Link, and Full Cloud Access via Cloud Link.
2. Platform Modes and Data Context
Understanding how we handle data requires understanding how each feature works:
File Sharing via LAN
File Sharing via LAN operates entirely on the local network without any internet connection, third-party infrastructure, or JoinCloud servers. Files transfer directly between the Host and Recipient devices. Transfer speed and reliability depend on: connection type (Mobile Hotspot; Wi-Fi 2.4 GHz; Wi-Fi 5 GHz; Wi-Fi 6 at 6 GHz; Wi-Fi 6E; Ethernet 100 Mbps; Gigabit Ethernet 1 Gbps; 2.5 Gbps Ethernet); storage type on both devices (HDD, SSD/SATA, NVMe/PCIe); disk read speed on the Host and write speed on the Recipient; available RAM and free storage space; and firewall configuration on both devices. JoinCloud storage is mounted via a storage mount server, which isolates the JoinCloud storage layer from the rest of the Host file system. Only the designated JoinCloud storage area is accessible, not the full system. Files reside on the Host device at all times and are never transferred to JoinCloud or any third-party server.
File Sharing via Remote Link
Remote Link file sharing routes transfers through secure third-party tunnel infrastructure, one of the most widely trusted internet infrastructure services globally. All data in transit is encrypted. File content is never stored by JoinCloud and cannot be accessed during transit. Transfer speed and availability depend on: third-party tunnel infrastructure availability; Host and Recipient connection type (Mobile Hotspot; Wi-Fi 2.4 GHz; Wi-Fi 5 GHz; Wi-Fi 6 at 6 GHz; Wi-Fi 6E); storage type on both devices (HDD, SSD/SATA, NVMe/PCIe); disk read speed on Host and write speed on Recipient; available RAM and free storage space; and firewall configuration. When a Remote Link is accessed by more than one user simultaneously, the concurrency layer activates automatically. This routes requests through JoinCloud tech infrastructure file caching via a third-party server to distribute load away from the Host device and ensure reliable availability to multiple recipients at the same time. The third-party caching server is used solely for this reliability purpose and is not used to store, analyse, or retain user data in any other way. Cached files are deleted from the third-party server at session end or when the link expires. The Remote Link and any associated concurrency are active only while the Host device is online and the JoinCloud application is running.
Full Cloud Access via Cloud Link
Full Cloud Access via Cloud Links provides the combined capability of LAN and Remote Link file sharing, enabling both local and internet-based access to files the Host has explicitly uploaded to JoinCloud cloud storage. Cloud Links enforce strict access controls: folder browsing is not permitted and only files explicitly uploaded by the Host are accessible. Cloud Links cannot be accessed by JoinCloud, third parties, or any other user until explicitly shared by the Host. The JoinCloud storage area is mounted via a storage mount server, separating it from the rest of the Host file system. Files live on the Host device and can be accessed from the Home section of the application. Files can only be deleted by the Host with explicit consent within the JoinCloud application. JoinCloud does not control the Host device and has no ability to delete, modify, or access files outside of actions explicitly initiated by the user. File loss attributable to JoinCloud is not possible under normal operation. Cloud Link availability depends on Host device availability. The same transfer performance factors apply as for LAN (local access) and Remote Links (internet access).
Devices
Lists devices available on the same local network only. No internet connection is required and no device data is transmitted to JoinCloud servers.
Activity
Tracks in-app usage events to give the user a history of their sharing activity. Requires internet connectivity to sync data to the Platform.
Performance
Provides a real-time performance score based on Host Device hardware (storage type, disk read/write speed, available memory, storage space) and network connectivity. Requires internet connectivity to report scores to the Platform.
Support and Settings
Support provides real-time in-app access to our support team. Settings contain important device and configuration details for managing the JoinCloud installation.
3. Storage Architecture
JoinCloud storage is mounted using a storage mount server. This architecture separates the JoinCloud storage cloud server from the rest of the Host file system, ensuring that only the designated JoinCloud storage area is accessible through the application. The full system file system is not exposed.
4. File Safety
Files shared or stored via JoinCloud reside solely on the Host device. JoinCloud does not control any Host device and provides only real-time application uptime, not device control. File deletion within JoinCloud requires explicit user consent and action within the application. File loss attributable to JoinCloud is not possible under normal operation. Storage can always be accessed from the Home section of the JoinCloud application.
5. Security
JoinCloud currently operates at version v0.3.6 (Beta). In this version, all file transfers are secured through secure third-party tunnel infrastructure encryption during transit. for a future release to provide full end-to-end shielding. Even in the current version, file content cannot be accessed by any party other than the Host and the users the Host has shared the link with. Full authentication, password protection, and related access controls are planned for implementation following product-market fit.
6. Information We Collect
6.1  Information you provide directly
Account registration details (name, email address)
Support queries submitted via in-app support, email, or the website contact form
6.2  Information collected automatically
Device information: operating system, app version, storage type (HDD, SSD, NVMe), device type, screen resolution
Usage data: features used, transfer modes initiated, session duration, Activity log events, in-app navigation
Performance data: network connection type, speed estimates, device performance score
Error logs and crash diagnostics
6.3  Information we do NOT collect
IP addresses or geographic location
Contents of any files shared via LAN, Remote Link, or Cloud Link
Folder structures or filenames of files not explicitly uploaded to Cloud Links
Sensitive personal data (financial, health, government ID)
7. Concurrency and JoinCloud tech infrastructure third-party caching server
When a Remote Link is accessed by more than one user at the same time, the concurrency layer activates automatically. Files are temporarily cached on a third-party server by JoinCloud tech infrastructure solely to ensure reliable availability to multiple recipients and to reduce load on the Host device. The third-party server is not used for data storage, analysis, or any other purpose. Cached files are deleted at session end or link expiry. JoinCloud does not access or read any cached file contents.
8. How We Use Your Information
Provide, operate, and improve the JoinCloud platform and its features
Power the Activity, Performance, and Support features within the application
Respond to support requests
Monitor for abuse, fraud, or Terms of Service violations
Generate anonymised, aggregated analytics to understand usage trends
Send service-related notices (security alerts, policy updates, app updates)
Comply with applicable legal obligations
9. Cookies
We use cookies on our website and application. Full details are in our Cookie Policy at https://www.joincloud.cloud/cookies. In summary: strictly necessary cookies (sessions), functional cookies (preferences), and analytics cookies (anonymised usage). You can manage preferences via browser settings or the in-app Cookie Preferences panel.
10. Data Sharing and Disclosure
We do not sell, rent, or trade personal data. We may share data with:
our third-party infrastructure and tunnel service provider: for Tunnel routing (Remote Links) and temporary concurrency staging (Cloud Links and Remote Links with concurrent access), subject to the service provider data processing agreement and privacy policy
Arevei.com (marketing partner): only aggregated, non-personally identifiable data unless separately consented
Service providers under strict confidentiality obligations
Law enforcement when required by applicable law
Successors in a merger or acquisition (you will be notified)
11. Data Retention
Account data is retained for the duration of your account. Files cached on third-party infrastructure are deleted at session end. Usage and performance data is retained in anonymised form. You may request deletion at any time by contacting info@joincloud.in.
12. Your Rights
You may have the right to access, correct, delete, or port your data, and to withdraw consent. Contact info@joincloud.in to exercise your rights. EU and UK users: see our GDPR and Data Processing Addendum at https://www.joincloud.cloud/gdpr.
13. Children's Privacy
JoinCloud is not directed at children under 13. We do not knowingly collect data from children. Contact us immediately if you believe a child's data has been submitted.
14. Unauthorized Data Transfers and Third-Party Misuse
JoinCloud is a file sharing infrastructure platform. We are fully committed to user privacy and data safety. JoinCloud does not store, access, or control any files on the Host device and has no ability to monitor the content of files transferred through the Platform.
JoinCloud is not responsible for unauthorized, illegal, or improper data transfers carried out by any user, organization, or third party using the application. The Host is solely responsible for the content they choose to share and the parties they choose to share it with.
If any concern, flag, complaint, or legal notice is raised by any user, organization, government authority, regulatory body, or legal authority regarding content shared through the Platform, JoinCloud will act as a mediator between the concerned party and the relevant user. Our role in any such matter is limited to:
Providing whatever information we are able to access within our own system infrastructure
Facilitating communication between the concerned authority and the user
Cooperating with lawful requests from legal or government authorities to the extent required by applicable law
Any information held by our third-party infrastructure providers is subject to their own data governance policies and legal obligations. JoinCloud cannot compel or guarantee disclosure of data held solely by third-party infrastructure providers.
JoinCloud will provide full support from our end in any such matter. However, as files reside solely on the Host device and are not stored on JoinCloud servers, our ability to produce file content or transfer records is inherently limited by this architecture.
15. Changes to This Policy
We will notify you of material changes via in-app notification or email. Continued use after changes constitutes acceptance.
16. Contact Us
Company:  Shakyawar Mediatech LLP
Email:       info@joincloud.in
Phone:      +91 9625440855
Address:   Arevei, S.No 2, 72A, New Patel Nagar, Near Sai Palace, Orai, 285001, Uttar Pradesh, India
Website:   https://www.joincloud.cloud`;

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
  const policyLines = PRIVACY_POLICY_TEXT.split("\n");

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
            Effective Date: April 8, 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-3 text-sm">
            {policyLines.map((line, index) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={index} className="h-2" />;
              }

              if (trimmed === "JoinCloud Privacy Policy") {
                return (
                  <h3 key={index} className="text-base font-semibold">
                    {trimmed}
                  </h3>
                );
              }

              if (/^\d+\./.test(trimmed)) {
                return (
                  <h4 key={index} className="text-sm font-semibold pt-2">
                    {trimmed}
                  </h4>
                );
              }

              if (/^\d+\.\d+/.test(trimmed)) {
                return (
                  <p key={index} className="font-medium text-foreground">
                    {trimmed}
                  </p>
                );
              }

              return (
                <p key={index} className="text-muted-foreground whitespace-pre-wrap">
                  {line}
                </p>
              );
            })}
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
            <p className="font-medium">0.3.6</p>
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
            <a href="https://www.joincloud.cloud/terms?utm_source=application&utm_medium=TOS&utm_campaign=user" target="_blank" rel="noopener noreferrer">
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

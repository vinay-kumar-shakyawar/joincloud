"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Switch, Route } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SharedFilesBar } from "@/components/shared-files-bar";
import Dashboard from "@/pages/dashboard"
import Files from "@/pages/files"
import Storage from "@/pages/storage"
import Settings from "@/pages/settings"
import Login from "@/pages/login"
import Signup from "@/pages/signup"
import NotFound from "@/pages/not-found"
import { useToast } from "@/hooks/use-toast"
import Shares from "@/pages/sharing";
import ElectronDashboard from "./pages/electron"
import { Badge } from "@/ui-kit"

interface User {
  id: string
  username: string
  email: string
}

function Router({ user }: { user: User | null }) {
  // if (!user) {
  //   return (
  //     <Switch>
  //       <Route path="/login" component={Login} />
  //       <Route path="/signup" component={Signup} />
  //       <Route component={Login} />
  //     </Switch>
  //   )
  // }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/files" component={Files} />
      <Route path="/shares" component={Shares} />
      <Route path="/storage" component={Storage} />
      <Route path="/settings" component={Settings} />
      <Route path="/electron" component={ElectronDashboard} />
      <Route component={NotFound} />
    </Switch>
  )
}

export default function App() {
  console.log("APP_RENDERED");
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const statusQuery = useQuery<{ status?: string }>({
    queryKey: ["/api/status"],
    queryFn: async () => {
      const res = await fetch("/api/status");
      if (!res.ok) {
        throw new Error("Status unavailable");
      }
      return res.json();
    },
    refetchInterval: 10000,
    retry: false,
  });

  // useEffect(() => {
  //   const fetchUser = async () => {
  //     try {
  //       const res = await fetch("/api/auth/me")
  //       if (res.ok) {
  //         const data = await res.json()
  //         setUser(data.user)
  //       }
  //     } catch (error) {
  //       console.error("Failed to fetch user:", error)
  //     } finally {
  //       setLoading(false)
  //     }
  //   }

  //   fetchUser()
  // }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  }

  // if (!user) {
  //   return (
  //     <QueryClientProvider client={queryClient}>
  //       <TooltipProvider>
  //         <Router user={null} />
  //         <Toaster />
  //       </TooltipProvider>
  //     </QueryClientProvider>
  //   )
  // }

  return (
    <TooltipProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between h-16 px-6 border-b gap-4 border-slate-700">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div>
                <Badge
                  variant={
                    statusQuery.isLoading
                      ? "warning"
                      : statusQuery.isError || statusQuery.data?.status !== "running"
                        ? "error"
                        : "success"
                  }
                >
                  {statusQuery.isLoading
                    ? "Recovering"
                    : statusQuery.isError || statusQuery.data?.status !== "running"
                      ? "Offline"
                      : "Healthy"}
                </Badge>
              </div>
            </header>
            <SharedFilesBar />
            <main className="flex-1 overflow-auto">
              <Router user={user} />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  )
}

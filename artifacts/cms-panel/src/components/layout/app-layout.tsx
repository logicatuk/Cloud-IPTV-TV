import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { getAuthUser } from "@/lib/auth";
import { useGetMe } from "@workspace/api-client-react";
import { clearAuth } from "@/lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location, setLocation] = useLocation();

  const user = getAuthUser();
  const { data: me, isError } = useGetMe({
    query: {
      enabled: !!user,
      retry: false,
    },
  });

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (isError) {
      clearAuth();
      setLocation("/login");
    }
  }, [isError, setLocation]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar can go here or inside pages */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

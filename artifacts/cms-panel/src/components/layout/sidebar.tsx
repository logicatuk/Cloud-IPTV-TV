import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Server, HardDrive, CreditCard, ClipboardList, LogOut, Settings, Menu, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthUser, clearAuth } from "@/lib/auth";
import { useAdminLogout } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  className?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ className, isOpen, setIsOpen }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const user = getAuthUser();
  const isSuperAdmin = user?.role === "superadmin";
  const { mutate: logout } = useAdminLogout();
  const { toast } = useToast();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        clearAuth();
        setLocation("/login");
      },
      onError: () => {
        clearAuth();
        setLocation("/login");
      },
    });
  };

  const isTopLevelReseller = user?.role === "reseller" && !user?.parent_id;

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/devices", label: "Devices", icon: HardDrive, show: true },
    { href: "/resellers", label: "Resellers", icon: Users, show: isSuperAdmin },
    { href: "/sub-resellers", label: "Sub-Resellers", icon: UsersRound, show: isTopLevelReseller },
    { href: "/servers", label: "Servers", icon: Server, show: isSuperAdmin },
    { href: "/credits", label: "Credits", icon: CreditCard, show: true },
    { href: "/audit-logs", label: "Audit Logs", icon: ClipboardList, show: isSuperAdmin },
  ];

  return (
    <div
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 z-40 relative",
        isOpen ? "w-64" : "w-0 md:w-20 overflow-hidden",
        className
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b">
        <div className={cn("flex items-center gap-2 overflow-hidden whitespace-nowrap", !isOpen && "md:hidden")}>
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
            MP
          </div>
          <span className="font-bold text-lg tracking-tight">MaxPlayer</span>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setIsOpen(!isOpen)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {links
            .filter((link) => link.show)
            .map((link) => {
              const active = location === link.href || location.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors group",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    !isOpen && "md:justify-center md:px-0"
                  )}
                  title={!isOpen ? link.label : undefined}
                >
                  <link.icon className="h-5 w-5 shrink-0" />
                  <span className={cn("transition-opacity", !isOpen && "md:hidden")}>{link.label}</span>
                </Link>
              );
            })}
        </nav>
      </div>

      <div className="border-t p-4 flex flex-col gap-2">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            !isOpen && "md:justify-center md:px-0"
          )}
          title={!isOpen ? "Profile" : undefined}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span className={cn("transition-opacity", !isOpen && "md:hidden")}>Profile</span>
        </Link>
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            !isOpen && "md:justify-center md:px-0"
          )}
          title={!isOpen ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className={cn("transition-opacity", !isOpen && "md:hidden")}>Logout</span>
        </button>
        <div className={cn("mt-4 text-xs text-muted-foreground truncate", !isOpen && "md:hidden")}>
          {user?.email}
        </div>
      </div>
    </div>
  );
}

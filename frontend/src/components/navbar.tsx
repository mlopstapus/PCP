"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { LogOut, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProjectSwitcher } from "@/components/project-switcher";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/prompts", label: "Prompts" },
  { href: "/workflows", label: "Workflows" },
  { href: "/metrics", label: "Metrics" },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="SpecHub"
                width={36}
                height={36}
                className="rounded-md"
              />
              <span className="text-base font-bold tracking-tight">Spec<span className="text-primary">Hub</span></span>
            </Link>
            <ProjectSwitcher />
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                      ? "text-foreground bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium leading-none">
                    {user.display_name || user.username}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isAdmin && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                        <Shield className="h-2 w-2 mr-0.5" />
                        admin
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  asChild
                  title="Settings"
                >
                  <Link href="/settings">
                    <Settings className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleLogout}
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectSwitcher } from "@/components/project-switcher";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/prompts", label: "Prompts" },
  { href: "/workflows", label: "Workflows" },
  { href: "/metrics", label: "Metrics" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  const pathname = usePathname();

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
            <Button size="sm" asChild>
              <Link href="/prompts/new">
                <Plus className="h-4 w-4 mr-1" />
                New Prompt
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

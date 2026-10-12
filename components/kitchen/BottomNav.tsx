"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const TABS = [
  { href: "/plan", label: "Week" },
  { href: "/shop", label: "Shop" },
  { href: "/recipes", label: "Recipes" },
  { href: "/prep", label: "Prep" },
  { href: "/settings", label: "Settings" },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login") || path.startsWith("/reset") || path.endsWith("/cook")) return null;
  return (
    <nav className="timber fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl justify-between px-6 py-4">
        {TABS.map(({ href, label }) => {
          const active = path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn("pb-1 text-[13px] transition-colors", active ? "border-b border-ink text-ink" : "text-muted hover:text-ink")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

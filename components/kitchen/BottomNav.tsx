"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/plan", label: "Week" },
  { href: "/shop", label: "Shop" },
  { href: "/recipes", label: "Recipes" },
  { href: "/settings", label: "Settings" },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/login") || path.startsWith("/reset") || path.endsWith("/cook")) return null;
  return (
    // Phones: tab bar along the bottom. Wider screens: a top bar with the wordmark.
    <nav className="timber fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b md:border-line md:pb-0">
      <div className="flex items-center justify-between gap-8 px-5 sm:px-8 lg:px-12 xl:px-16">
      <Link href="/" className="hidden py-5 text-[15px] font-medium tracking-[-0.01em] md:block">Ben&apos;s Meals</Link>
      <ul className="flex flex-1 justify-between py-4 md:flex-none md:justify-end md:gap-10 md:py-5">
        {TABS.map(({ href, label }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href) || (href === "/plan" && path.startsWith("/prep"));
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
      </div>
    </nav>
  );
}

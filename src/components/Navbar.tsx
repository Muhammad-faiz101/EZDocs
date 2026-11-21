"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const NAV_ITEMS = [
  { href: "/services", label: "Services" },
  { href: "/resume", label: "My checklists" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/resume" && pathname.startsWith("/checklists"));

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="EZDocs home">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(item.href)
                  ? "font-medium text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="text-slate-500 hover:text-slate-900"
          >
            Admin
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200 px-4 py-2 text-sm md:hidden">
          {[...NAV_ITEMS, { href: "/admin", label: "Admin" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block py-2.5 ${
                isActive(item.href)
                  ? "font-medium text-slate-900"
                  : "text-slate-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

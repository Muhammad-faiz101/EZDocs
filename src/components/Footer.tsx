import React from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-sm text-slate-600 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <BrandLogo />
          <p className="mt-2">
            The requirements on this site are sample information. Always
            confirm with the office before you visit.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-2">
          <Link href="/services" className="hover:text-slate-900">
            Services
          </Link>
          <Link href="/resume" className="hover:text-slate-900">
            My checklists
          </Link>
          <Link href="/about" className="hover:text-slate-900">
            About
          </Link>
          <Link href="/admin" className="hover:text-slate-900">
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}

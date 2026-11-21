"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  AdminOverview,
  type AdminStatsData,
} from "@/components/admin/AdminOverview";
import { AdminServicesManager } from "@/components/admin/AdminServicesManager";
import { AdminDocumentsManager } from "@/components/admin/AdminDocumentsManager";
import { AdminVersionsManager } from "@/components/admin/AdminVersionsManager";
import { AdminVersionCompare } from "@/components/admin/AdminVersionCompare";
import type { DocumentRecord, ServiceRecord } from "@/lib/types";

type AdminTab = "overview" | "services" | "documents" | "versions" | "compare";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

const TABS: { key: AdminTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "documents", label: "Documents" },
  { key: "versions", label: "Checklist versions" },
  { key: "compare", label: "Compare versions" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [statsData, setStatsData] = useState<AdminStatsData | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number>(0);

  const loadAdminData = useCallback(async () => {
    const [statsRes, svcRes, docRes] = await Promise.all([
      fetch("/api/stats"),
      fetch("/api/services?includeInactive=true"),
      fetch("/api/admin/documents"),
    ]);
    if (statsRes.ok) setStatsData(await statsRes.json());
    if (svcRes.ok) {
      const list = ((await svcRes.json()).services || []) as ServiceRecord[];
      setServices(list);
      setSelectedServiceId((prev) => prev || list[0]?.id || 0);
    }
    if (docRes.ok) setDocuments((await docRes.json()).documents || []);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/admin/auth/me");
        const data = await res.json();
        if (!data.authenticated) {
          router.replace("/admin/login");
          return;
        }
        if (active) {
          setAdmin(data.admin);
          await loadAdminData();
        }
      } finally {
        if (active) setCheckingAuth(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router, loadAdminData]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!admin) return null;

  const navButton = (tab: { key: AdminTab; label: string }) => (
    <button
      key={tab.key}
      type="button"
      onClick={() => {
        setActiveTab(tab.key);
        setMenuOpen(false);
      }}
      className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
        activeTab === tab.key
          ? "bg-slate-100 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {tab.label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <Link href="/">
            <BrandLogo />
          </Link>
          <span className="ml-2 text-xs text-slate-500">Admin</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">{TABS.map(navButton)}</nav>
        <div className="border-t border-slate-200 p-4 text-sm">
          <p className="text-slate-800">{admin.name}</p>
          <p className="truncate text-xs text-slate-500">{admin.email}</p>
          <div className="mt-3 flex justify-between">
            <Link href="/" className="text-link">
              View site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-slate-600 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <BrandLogo />
            <span className="text-xs text-slate-500">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {menuOpen && (
          <nav className="space-y-0.5 border-b border-slate-200 bg-white p-3 lg:hidden">
            {TABS.map(navButton)}
            <div className="flex justify-between px-3 pt-3 text-sm">
              <Link href="/" className="text-link">
                View site
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-600"
              >
                Sign out
              </button>
            </div>
          </nav>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {activeTab === "overview" && (
            <AdminOverview data={statsData} onNavigateTab={setActiveTab} />
          )}
          {activeTab === "services" && (
            <AdminServicesManager
              services={services}
              onRefresh={loadAdminData}
              onSelectServiceForVersions={(svcId) => {
                setSelectedServiceId(svcId);
                setActiveTab("versions");
              }}
            />
          )}
          {activeTab === "documents" && (
            <AdminDocumentsManager
              documents={documents}
              onRefresh={loadAdminData}
            />
          )}
          {activeTab === "versions" && (
            <AdminVersionsManager
              services={services}
              documents={documents}
              selectedServiceId={selectedServiceId}
              onChangeServiceId={setSelectedServiceId}
              onRefreshAll={loadAdminData}
              onJumpToCompare={(svcId) => {
                setSelectedServiceId(svcId);
                setActiveTab("compare");
              }}
            />
          )}
          {activeTab === "compare" && (
            <AdminVersionCompare
              services={services}
              initialServiceId={selectedServiceId}
            />
          )}
        </main>
      </div>
    </div>
  );
}

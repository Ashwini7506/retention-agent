"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Dashboard,
  Analytics,
  Settings as SettingsIcon,
  User as UserIcon,
  ContentView,
  TestTool as Experiment,
  FunnelSort as FunnelChart,
  UserActivity,
  Logout,
} from "@carbon/icons-react";
import { createClient } from "@/lib/supabase/client";

/* ─── Logo ─────────────────────────────────────────────────────────────── */

function FunnelMindLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="FunnelMind"
      className="w-full h-full object-cover"
      style={{ objectPosition: "45% center", transform: "scale(1.6)" }}
    />
  );
}

/* ─── Avatar ────────────────────────────────────────────────────────────── */

function AvatarCircle() {
  return (
    <div className="rounded-full shrink-0 size-8 bg-neutral-800 flex items-center justify-center">
      <UserIcon size={15} className="text-neutral-300" />
    </div>
  );
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface NavItemT {
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface AgentT {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
  stub?: boolean;
}

/* ─── Agents ────────────────────────────────────────────────────────────── */

const AGENTS: AgentT[] = [
  {
    id: "retention",
    label: "Retention Agent",
    icon: <Analytics size={17} />,
    activeColor: "bg-indigo-600",
  },
  {
    id: "content",
    label: "Content Agent",
    icon: <ContentView size={17} />,
    activeColor: "bg-violet-600",
    stub: true,
  },
];

/* ─── Nav items ─────────────────────────────────────────────────────────── */

const RETENTION_NAV: NavItemT[] = [
  { href: "/dashboard",   icon: <Dashboard size={16} />,    label: "Dashboard"       },
  { href: "/funnel",      icon: <FunnelChart size={16} />,  label: "Funnel Health"   },
  { href: "/experiments", icon: <Experiment size={16} />,   label: "Experiments"     },
  { href: "/metrics",     icon: <Analytics size={16} />,    label: "Metrics"         },
  { href: "/users",       icon: <UserActivity size={16} />, label: "User Behaviour"  },
];

/* ─── Left agent rail ───────────────────────────────────────────────────── */

function AgentRail({
  activeAgent,
  onAgentChange,
}: {
  activeAgent: string;
  onAgentChange: (id: string) => void;
}) {
  return (
    <aside className="bg-neutral-950 flex flex-col items-center py-4 px-2 gap-2 w-14 min-h-screen border-r border-neutral-800/60 shrink-0">
      <div className="mb-3 w-11 h-11 flex items-center justify-center rounded-xl overflow-hidden">
        <FunnelMindLogo />
      </div>

      <div className="flex flex-col gap-2 w-full items-center flex-1">
        {AGENTS.map((agent) => {
          const isActive = activeAgent === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              title={agent.stub ? `${agent.label} (coming soon)` : agent.label}
              onClick={() => !agent.stub && onAgentChange(agent.id)}
              className={`
                relative flex flex-col items-center justify-center rounded-xl size-10 transition-all duration-200
                ${isActive
                  ? `${agent.activeColor} text-white shadow-lg`
                  : agent.stub
                    ? "bg-neutral-900 text-neutral-700 cursor-not-allowed"
                    : "bg-neutral-900 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                }
              `}
            >
              {agent.icon}
              {agent.stub && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-neutral-700 text-neutral-500 rounded px-1 leading-tight">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 items-center pt-3 border-t border-neutral-800/60 w-full">
        <button
          type="button"
          title="Settings"
          className="flex items-center justify-center rounded-xl size-10 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors duration-200"
        >
          <SettingsIcon size={17} />
        </button>
        <AvatarCircle />
      </div>
    </aside>
  );
}

/* ─── Nav item ──────────────────────────────────────────────────────────── */

function NavLink({ item, active }: { item: NavItemT; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`
        rounded-lg flex items-center gap-2.5 px-3 h-9 transition-colors duration-150 group
        ${active
          ? "bg-neutral-800 text-white"
          : "hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-200"
        }
      `}
    >
      <span className={`shrink-0 transition-colors ${active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}>
        {item.icon}
      </span>
      <span className="flex-1 text-sm">{item.label}</span>
    </Link>
  );
}

/* ─── Nav panel ─────────────────────────────────────────────────────────── */

function NavPanel({ activeAgent }: { activeAgent: string }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }
  const agent = AGENTS.find((a) => a.id === activeAgent)!;
  const navItems = activeAgent === "retention" ? RETENTION_NAV : [];

  return (
    <aside className="bg-neutral-950 border-r border-neutral-800/60 flex flex-col min-h-screen w-52 shrink-0">
      <div className="px-4 py-4 border-b border-neutral-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`size-2 rounded-full ${agent.activeColor}`} />
          <span className="text-sm font-semibold text-neutral-100">{agent.label}</span>
        </div>
        <p className="text-[11px] text-neutral-600 mt-0.5 pl-4">OutX.AI</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
          />
        ))}
      </div>

      <div className="border-t border-neutral-800/60 px-3 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <AvatarCircle />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-200 truncate">OutX.AI</p>
            <p className="text-[11px] text-neutral-600 truncate">Internal Tool</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="text-neutral-600 hover:text-neutral-300 transition-colors p-1 rounded hover:bg-neutral-800"
          >
            <Logout size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ─── Main exported component ───────────────────────────────────────────── */

export function FunnelMindSidebar({ children }: { children?: React.ReactNode }) {
  const [activeAgent, setActiveAgent] = useState("retention");

  return (
    <div className="flex min-h-screen bg-neutral-950">
      <AgentRail activeAgent={activeAgent} onAgentChange={setActiveAgent} />
      <NavPanel activeAgent={activeAgent} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default FunnelMindSidebar;

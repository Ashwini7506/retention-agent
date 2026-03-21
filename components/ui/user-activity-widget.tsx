"use client";

import * as React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Clock, Users, Zap, ArrowRight, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface CategoryStat {
  label: string;
  value: number; // percentage 0–100
  color: string; // tailwind bg class
}

interface TopUser {
  id: string;
  initials: string;
  event_count: number;
}

interface UserActivityWidgetProps {
  avgSessionMinutes: number | null;
  avgPromptSeconds: number | null;
  dau: number;
  topUsers: TopUser[];
  categoryBreakdown: CategoryStat[];
  date: string | null;
  onViewFunnel?: () => void;
  className?: string;
}

/* ─── Animated number ────────────────────────────────────────────────────── */

const AnimatedNumber = ({ value, decimals = 0 }: { value: number; decimals?: number }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    decimals > 0 ? v.toFixed(decimals) : String(Math.round(v))
  );

  React.useEffect(() => {
    const controls = animate(count, value, { duration: 1.4, ease: "easeOut" });
    return controls.stop;
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
};

/* ─── The widget ─────────────────────────────────────────────────────────── */

export const UserActivityWidget = React.forwardRef<HTMLDivElement, UserActivityWidgetProps>(
  (
    {
      avgSessionMinutes,
      avgPromptSeconds,
      dau,
      topUsers,
      categoryBreakdown,
      date,
      onViewFunnel,
      className,
    },
    ref
  ) => {
    const spring = { type: "spring" as const, stiffness: 300, damping: 18 };

    const container = {
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
    };
    const item = {
      hidden: { opacity: 0, y: 12 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
    };

    const sessionDisplay =
      avgSessionMinutes !== null
        ? avgSessionMinutes < 1
          ? `<1`
          : avgSessionMinutes
        : null;

    const promptDisplay = avgPromptSeconds !== null ? avgPromptSeconds : null;

    return (
      <motion.div
        ref={ref}
        className={cn(
          "w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5",
          className
        )}
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">User Activity</h2>
            {date && (
              <p className="text-[11px] text-zinc-600 mt-0.5">
                {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </motion.div>

        {/* Two cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">

          {/* Session time card */}
          <motion.div variants={item} whileHover={{ scale: 1.025, y: -4 }} transition={spring}>
            <Card className="h-full bg-zinc-800/60 border-zinc-700/60 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-zinc-400">Avg. Session Time</p>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </div>

                {/* Session minutes */}
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">
                    {avgSessionMinutes !== null ? (
                      <AnimatedNumber value={avgSessionMinutes} decimals={1} />
                    ) : (
                      "—"
                    )}
                  </span>
                  {avgSessionMinutes !== null && (
                    <span className="ml-1.5 text-sm text-zinc-500">min / session</span>
                  )}
                  {avgSessionMinutes === null && (
                    <span className="ml-1.5 text-xs text-zinc-600">single-event day</span>
                  )}
                </div>

                {/* Prompt time sub-stat */}
                <div className="flex items-center gap-1.5 mb-4 mt-2">
                  <Timer className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs text-zinc-500">
                    Avg prompt flow:{" "}
                    <span className="text-indigo-300 font-mono">
                      {promptDisplay !== null ? `${promptDisplay}s` : "—"}
                    </span>
                  </span>
                </div>

                {/* Category breakdown bar */}
                {categoryBreakdown.length > 0 && (
                  <>
                    <div className="w-full h-2 mb-2.5 overflow-hidden rounded-full bg-zinc-700 flex">
                      {categoryBreakdown.map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          className={cn("h-full", stat.color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.value}%` }}
                          transition={{ duration: 0.8, delay: 0.4 + i * 0.08 }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {categoryBreakdown.map((stat) => (
                        <div key={stat.label} className="flex items-center gap-1">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", stat.color)} />
                          <span className="text-[10px] text-zinc-500">{stat.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* DAU card */}
          <motion.div variants={item} whileHover={{ scale: 1.025, y: -4 }} transition={spring}>
            <Card className="h-full bg-indigo-950/40 border-indigo-800/40 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-indigo-300">Daily Active Users</p>
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-white">
                    <AnimatedNumber value={dau} />
                  </span>
                  <span className="ml-1.5 text-sm text-indigo-400">
                    {date ? `on ${date}` : "users today"}
                  </span>
                </div>

                {/* Avatar stack */}
                {topUsers.length > 0 && (
                  <div className="flex -space-x-2">
                    {topUsers.slice(0, 5).map((user, i) => (
                      <motion.div
                        key={user.id}
                        title={`${user.event_count} events`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.7 + i * 0.08 }}
                        whileHover={{ scale: 1.2, zIndex: 10, y: -2 }}
                      >
                        <Avatar className="border-2 border-indigo-900 w-8 h-8">
                          <AvatarFallback className="bg-indigo-800 text-indigo-200 text-[10px]">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                    ))}
                    {dau > 5 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 1.1 }}
                        className="w-8 h-8 rounded-full border-2 border-indigo-900 bg-indigo-800/60 flex items-center justify-center"
                      >
                        <span className="text-[9px] text-indigo-300 font-medium">
                          +{dau - 5}
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {topUsers.length === 0 && (
                  <p className="text-xs text-indigo-800">No events on this day</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* CTA banner */}
        <motion.div
          variants={item}
          whileHover={{ scale: 1.015 }}
          transition={spring}
        >
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-zinc-700/60">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xs text-zinc-400">
                See where users drop off and what drives activation
              </p>
            </div>
            <Button
              size="sm"
              onClick={onViewFunnel}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8"
            >
              Funnel
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

UserActivityWidget.displayName = "UserActivityWidget";

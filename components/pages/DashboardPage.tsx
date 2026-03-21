"use client";

import { useEffect, useState, useMemo, FC } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserActivityWidget } from "@/components/ui/user-activity-widget";
import { Users, TrendingUp, RefreshCw, CreditCard, BarChart2 } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type MetricLatest = {
  value: number | null;
  user_count: number;
  computed_on: string;
} | null;

type MetricData = {
  label: string;
  description: string;
  latest: MetricLatest;
  history: { date: string; value: number | null }[];
  available: boolean;
};

type DashboardData = {
  window: { current_day: number; window_start: string | null };
  metrics: {
    dau: MetricData;
    d7_retention: MetricData;
    d28_retention: MetricData;
    paid_users: MetricData;
  };
};

type ActivityStats = {
  date: string | null;
  avg_session_minutes: number | null;
  avg_prompt_seconds: number | null;
  dau: number;
  top_users: { id: string; initials: string; event_count: number }[];
  category_breakdown: { label: string; value: number; color: string }[];
  total_events: number;
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatValue(value: number | null, available: boolean): string {
  if (!available) return "—";
  if (value === null || value === undefined) return "—";
  if (value > 0 && value <= 1) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString();
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ─── Metric card ───────────────────────────────────────────────────────── */

const MetricCard: FC<{
  metric: MetricData;
  icon: React.ReactNode;
  accentColor: string;
  trend?: number | null;
}> = ({ metric, icon, accentColor, trend }) => {
  const displayValue = formatValue(metric.latest?.value ?? null, metric.available);
  const isPercent = metric.latest?.value != null && metric.latest.value > 0 && metric.latest.value <= 1;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
          {metric.label}
        </CardTitle>
        <span className={accentColor}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold tracking-tight ${metric.available ? "text-white" : "text-zinc-700"}`}>
          {displayValue}
        </div>
        {trend != null && metric.available && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            <span>{trend >= 0 ? "↑" : "↓"}</span>
            <span>{Math.abs(trend).toFixed(1)}{isPercent ? "pp" : ""} vs prev</span>
          </div>
        )}
        <p className="text-[11px] text-zinc-600 mt-1.5">{metric.description}</p>
      </CardContent>
    </Card>
  );
};

/* ─── Trend chart ───────────────────────────────────────────────────────── */

const TrendChart: FC<{
  title: string;
  data: { date: string; value: number | null }[];
  lineColor: string;
  metricLabel: string;
  isPercent?: boolean;
}> = ({ title, data, lineColor, metricLabel, isPercent }) => {
  const chartData = useMemo(() =>
    data
      .filter((d) => d.value !== null)
      .map((d) => ({
        date: formatShortDate(d.date),
        value: isPercent && d.value != null && d.value <= 1
          ? parseFloat((d.value * 100).toFixed(1))
          : d.value,
      })),
    [data, isPercent]
  );

  if (chartData.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-zinc-300">
            <BarChart2 className="h-4 w-4 text-zinc-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center">
            <p className="text-zinc-700 text-xs">No trend data yet — run pipeline daily to accumulate</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-zinc-300">
          <BarChart2 className="h-4 w-4 text-zinc-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: "180px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.6} />
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} tick={{ fill: "#71717a" }} interval="preserveStartEnd" />
              <YAxis stroke="#52525b" fontSize={10} tick={{ fill: "#71717a" }} tickFormatter={(v) => isPercent ? `${v}%` : v.toString()} width={32} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "0.5rem", fontSize: "12px" }}
                itemStyle={{ color: "#e4e4e7" }}
                labelStyle={{ color: "#71717a" }}
                formatter={(v) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [isPercent ? `${n}%` : n.toLocaleString(), metricLabel];
                }}
              />
              <Line type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2}
                dot={chartData.length <= 10 ? { fill: lineColor, r: 3 } : false}
                name={metricLabel} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Window banner ─────────────────────────────────────────────────────── */

function WindowBanner({ day, start }: { day: number; start: string | null }) {
  const pct = Math.min(((day - 1) / 28) * 100, 100);
  const startStr = start
    ? new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-400">28-day window · Day {day}</span>
          <span className="text-xs text-zinc-600">Started {startStr} · {28 - day + 1}d until report</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-zinc-500">Live</span>
      </div>
    </div>
  );
}

/* ─── Main dashboard ────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const onViewFunnel = () => router.push("/funnel");
  const [data, setData] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/activity-stats").then((r) => r.json()).catch(() => null),
    ])
      .then(([dashData, activityData]) => {
        setData(dashData);
        setActivity(activityData);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const trend = (metric: MetricData | undefined): number | null => {
    if (!metric || !metric.available) return null;
    const h = metric.history.filter((d) => d.value !== null);
    if (h.length < 2) return null;
    const curr = h[h.length - 1].value!;
    const prev = h[h.length - 2].value!;
    if (prev === 0) return null;
    const isRatio = curr <= 1 && prev <= 1;
    return isRatio
      ? parseFloat(((curr - prev) * 100).toFixed(2))
      : parseFloat((curr - prev).toFixed(1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 flex items-center justify-center">
        <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-5 py-4">
          <p className="text-red-400 text-sm">Error: {error}</p>
        </div>
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">OutX.AI · Growth & Retention</p>
        </div>

        {/* Window progress */}
        {data?.window && (
          <WindowBanner day={data.window.current_day} start={data.window.window_start} />
        )}

        {/* 4 metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            metric={m?.dau ?? { label: "DAU", description: "Daily active users", latest: null, history: [], available: false }}
            icon={<Users className="h-4 w-4" />}
            accentColor="text-indigo-400"
            trend={trend(m?.dau)}
          />
          <MetricCard
            metric={m?.d7_retention ?? { label: "WAU / D7", description: "Weekly active users", latest: null, history: [], available: false }}
            icon={<TrendingUp className="h-4 w-4" />}
            accentColor="text-violet-400"
            trend={trend(m?.d7_retention)}
          />
          <MetricCard
            metric={m?.d28_retention ?? { label: "D28 Retention", description: "28-day retention", latest: null, history: [], available: false }}
            icon={<RefreshCw className="h-4 w-4" />}
            accentColor="text-blue-400"
            trend={trend(m?.d28_retention)}
          />
          <MetricCard
            metric={m?.paid_users ?? { label: "Paid Conversion", description: "Trial-to-paid rate", latest: null, history: [], available: false }}
            icon={<CreditCard className="h-4 w-4" />}
            accentColor="text-emerald-400"
            trend={trend(m?.paid_users)}
          />
        </div>

        {/* Trend charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendChart title="DAU Trend" data={m?.dau?.history ?? []} lineColor="#6366f1" metricLabel="Daily Active Users" />
          <TrendChart title="WAU / D7 Trend" data={m?.d7_retention?.history ?? []} lineColor="#8b5cf6" metricLabel="Weekly Active Users" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendChart title="Paid Conversion Trend" data={m?.paid_users?.history ?? []} lineColor="#10b981" metricLabel="Trial-to-Paid %" isPercent />
          <TrendChart title="D28 Retention Trend" data={m?.d28_retention?.history ?? []} lineColor="#3b82f6" metricLabel="D28 Retention %" isPercent />
        </div>

        {/* User activity widget */}
        <UserActivityWidget
          avgSessionMinutes={activity?.avg_session_minutes ?? null}
          avgPromptSeconds={activity?.avg_prompt_seconds ?? null}
          dau={activity?.dau ?? 0}
          topUsers={activity?.top_users ?? []}
          categoryBreakdown={activity?.category_breakdown ?? []}
          date={activity?.date ?? null}
          onViewFunnel={onViewFunnel}
        />

      </div>
    </div>
  );
}

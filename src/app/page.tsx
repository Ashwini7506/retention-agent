"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type MetricResult = {
  id: string;
  name: string;
  description: string;
  is_template: boolean;
  latest_result: {
    value: number | null;
    breakdown: Record<string, number> | null;
    user_count: number;
    computed_on: string;
  } | null;
};

function formatValue(value: number | null): string {
  if (value === null || value === undefined) return "—";
  // Treat as percentage if between 0 and 1
  if (value > 0 && value <= 1) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString();
}

function MetricCard({ metric }: { metric: MetricResult }) {
  const result = metric.latest_result;
  const value = result?.value ?? null;
  const isRatio = value !== null && value > 0 && value <= 1;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-zinc-300 leading-snug">
            {metric.name}
          </CardTitle>
          {metric.is_template && (
            <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-700 shrink-0">
              template
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-white tracking-tight">
          {formatValue(value)}
        </p>
        {result?.user_count != null && (
          <p className="text-xs text-zinc-500 mt-1">
            {result.user_count.toLocaleString()} users · {result.computed_on}
          </p>
        )}
        {result?.breakdown && (
          <div className="mt-3 space-y-1">
            {Object.entries(result.breakdown)
              .slice(0, 4)
              .map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs text-zinc-400">
                  <span className="truncate">{key}</span>
                  <span className="ml-2 font-mono">
                    {isRatio ? `${((val as number) * 100).toFixed(1)}%` : (val as number).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        )}
        {!result && (
          <p className="text-xs text-zinc-600 mt-1">No data yet</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Group metrics by category for layout
  const acquisition = metrics.filter((m) =>
    m.name.toLowerCase().includes("signup") || m.name.toLowerCase().includes("acquisition")
  );
  const engagement = metrics.filter((m) =>
    m.name.toLowerCase().includes("dau") || m.name.toLowerCase().includes("wau") || m.name.toLowerCase().includes("watchlist")
  );
  const activation = metrics.filter((m) =>
    m.name.toLowerCase().includes("extension") || m.name.toLowerCase().includes("prompt") || m.name.toLowerCase().includes("onboarding")
  );
  const retention = metrics.filter((m) =>
    m.name.toLowerCase().includes("retention")
  );
  const conversion = metrics.filter((m) =>
    m.name.toLowerCase().includes("payment") || m.name.toLowerCase().includes("paid") || m.name.toLowerCase().includes("trial")
  );

  const sections = [
    { label: "Acquisition", metrics: acquisition },
    { label: "Activation", metrics: activation },
    { label: "Engagement", metrics: engagement },
    { label: "Retention", metrics: retention },
    { label: "Conversion", metrics: conversion },
  ].filter((s) => s.metrics.length > 0);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">FunnelMind</h1>
          <p className="text-sm text-zinc-500 mt-1">OutX.AI · Growth & Retention Intelligence</p>
        </div>

        <Separator className="bg-zinc-800 mb-8" />

        {loading && (
          <p className="text-zinc-500 text-sm">Loading metrics...</p>
        )}

        {error && (
          <p className="text-red-400 text-sm">Error: {error}</p>
        )}

        {!loading && !error && sections.map((section) => (
          <div key={section.label} className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              {section.label}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {section.metrics.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </div>
        ))}

      </div>
    </main>
  );
}

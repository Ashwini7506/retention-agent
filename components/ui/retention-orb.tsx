"use client";
import React from "react";

export default function RetentionOrb() {
  return (
    <>
      <style>{`
        @keyframes orbit-a {
          from { transform: rotate(0deg) translateX(115px); }
          to   { transform: rotate(360deg) translateX(115px); }
        }
        @keyframes orbit-b {
          from { transform: rotate(130deg) translateX(85px); }
          to   { transform: rotate(490deg) translateX(85px); }
        }
        @keyframes orbit-c {
          from { transform: rotate(260deg) translateX(135px); }
          to   { transform: rotate(-100deg) translateX(135px); }
        }
        @keyframes orbit-d {
          from { transform: rotate(50deg) translateX(100px); }
          to   { transform: rotate(410deg) translateX(100px); }
        }
        @keyframes pulse-out {
          0%   { transform: scale(0.95); opacity: 0.5; }
          100% { transform: scale(1.6);  opacity: 0; }
        }
        @keyframes core-breathe {
          0%, 100% { box-shadow: 0 0 30px rgba(99,102,241,0.25), 0 0 60px rgba(99,102,241,0.08); }
          50%       { box-shadow: 0 0 50px rgba(99,102,241,0.4),  0 0 90px rgba(99,102,241,0.15); }
        }
        @keyframes data-stream {
          0%   { opacity: 0; transform: translateY(-8px); }
          50%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(8px); }
        }
      `}</style>

      <div className="relative flex items-center justify-center" style={{ width: 310, height: 310 }}>

        {/* Pulse rings */}
        <div className="absolute rounded-full border border-indigo-500/25"
          style={{ width: 240, height: 240, animation: "pulse-out 3.2s ease-out infinite" }} />
        <div className="absolute rounded-full border border-indigo-400/15"
          style={{ width: 240, height: 240, animation: "pulse-out 3.2s ease-out infinite", animationDelay: "1.6s" }} />

        {/* Guide rings */}
        <div className="absolute rounded-full border border-zinc-800/70" style={{ width: 270, height: 270 }} />
        <div className="absolute rounded-full border border-zinc-800/50" style={{ width: 230, height: 230 }} />
        <div className="absolute rounded-full border border-zinc-800/30" style={{ width: 180, height: 180 }} />

        {/* Orbiting dots — absolute positioned at center, animated out */}
        {/* Green: healthy users */}
        <div className="absolute" style={{ top: "50%", left: "50%", width: 0, height: 0 }}>
          <div style={{
            position: "absolute",
            width: 11, height: 11,
            marginTop: -5.5, marginLeft: -5.5,
            borderRadius: "50%",
            background: "#10b981",
            boxShadow: "0 0 12px rgba(16,185,129,0.9)",
            animation: "orbit-a 9s linear infinite",
          }} />
        </div>

        {/* Amber: at-risk users */}
        <div className="absolute" style={{ top: "50%", left: "50%", width: 0, height: 0 }}>
          <div style={{
            position: "absolute",
            width: 9, height: 9,
            marginTop: -4.5, marginLeft: -4.5,
            borderRadius: "50%",
            background: "#f59e0b",
            boxShadow: "0 0 10px rgba(245,158,11,0.9)",
            animation: "orbit-b 13s linear infinite",
          }} />
        </div>

        {/* Red: critical users */}
        <div className="absolute" style={{ top: "50%", left: "50%", width: 0, height: 0 }}>
          <div style={{
            position: "absolute",
            width: 8, height: 8,
            marginTop: -4, marginLeft: -4,
            borderRadius: "50%",
            background: "#ef4444",
            boxShadow: "0 0 10px rgba(239,68,68,0.9)",
            animation: "orbit-c 6s linear infinite",
          }} />
        </div>

        {/* Second green dot */}
        <div className="absolute" style={{ top: "50%", left: "50%", width: 0, height: 0 }}>
          <div style={{
            position: "absolute",
            width: 7, height: 7,
            marginTop: -3.5, marginLeft: -3.5,
            borderRadius: "50%",
            background: "#34d399",
            boxShadow: "0 0 8px rgba(52,211,153,0.8)",
            animation: "orbit-d 11s linear infinite",
          }} />
        </div>

        {/* Core sphere */}
        <div className="relative flex flex-col items-center justify-center"
          style={{
            width: 110, height: 110,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #27272a 0%, #09090b 100%)",
            border: "1px solid rgba(99,102,241,0.3)",
            animation: "core-breathe 4s ease-in-out infinite",
          }}>
          <span className="text-xl font-bold text-zinc-100 font-mono leading-none">7,923</span>
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">users</span>
          <div className="flex gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="healthy" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="at-risk" />
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="critical" />
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-4 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />healthy</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />at-risk</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />critical</span>
        </div>
      </div>
    </>
  );
}

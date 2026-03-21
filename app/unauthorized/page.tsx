import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-900/50 flex items-center justify-center mb-6">
        <ShieldX className="w-7 h-7 text-rose-400" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
        FunnelMind is an internal OutX.AI tool. Access is restricted to{" "}
        <span className="text-zinc-300">@outx.ai</span> email addresses.
      </p>
      <Link
        href="/login"
        className="mt-8 px-5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors"
      >
        Try a different email
      </Link>
    </div>
  );
}

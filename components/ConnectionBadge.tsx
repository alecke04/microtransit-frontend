"use client";

type ConnectionBadgeProps = {
  connected: boolean;
};

export default function ConnectionBadge({ connected }: ConnectionBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm mb-4 ${
      connected 
        ? 'bg-fpuBg text-fpuCyan border border-fpuCyan' 
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-fpuCyan animate-pulse' : 'bg-red-500'}`}/>
      {connected ? 'Live Connected' : 'Disconnected'}
    </div>
  );
}

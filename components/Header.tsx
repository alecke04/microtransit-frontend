"use client";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="w-full px-6 py-3 flex items-center justify-between">
        <div className="flex items-center flex-shrink-0">
          <img 
            src="/FLPolyFullLogo_RGB-FC-1024x259.png" 
            alt="Florida Polytechnic University"
            className="h-10 w-auto"
          />
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-auto">
          <span className="text-sm font-medium text-fpuCyan">Live Tracking</span>
          <div className="w-3 h-3 bg-fpuCyan rounded-full animate-pulse"></div>
        </div>
      </div>
    </header>
  );
}

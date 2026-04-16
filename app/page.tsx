import Link from "next/link";
import Header from "@/components/Header";

export default function HomePage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      
      <main 
        className="relative flex-1 flex items-center justify-center"
        style={{ 
          backgroundImage: 'url(/FPU-Img-Campus-13.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.42)' }}></div>
        
        <div className="relative z-10 w-full px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 md:mb-8 relative">
              <h1 className="text-3xl md:text-5xl font-bold mb-3 text-fpuCyan uppercase" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                MicroTransit Tracker
              </h1>
              <p className="text-base md:text-xl text-gray-100">
                Track your campus shuttle in real time
              </p>
            </div>

            <Link
              href="/map"
              className="inline-block px-8 py-3 bg-fpuCyan text-white rounded-lg font-semibold hover:scale-105 transition-transform"
            >
              Open Live Tracker
            </Link>

            <div className="mt-8 md:mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto text-[10px] md:text-sm">
              <div>
                <p className="text-gray-100 font-medium">Real-Time Tracking</p>
              </div>
              <div>
                <p className="text-gray-100 font-medium">Historical Data</p>
              </div>
              <div>
                <p className="text-gray-100 font-medium">Live WebSocket</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="flex-shrink-0 bg-white border-t border-gray-100 py-2 md:py-3">
        <div className="w-full px-4 text-center">
          <p className="text-[9px] md:text-xs text-gray-500 leading-none mb-1">
            Made with <span className="text-fpuCyan font-bold">Next.js</span> & <span className="text-fpuCyan font-bold">FastAPI</span>
          </p>
          <p className="text-[8px] md:text-[10px] text-gray-400 leading-none uppercase tracking-tighter">
            © Florida Poly | MicroTransit System
          </p>
        </div>
      </footer>
    </div>
  );
}

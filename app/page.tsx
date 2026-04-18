import Link from "next/link";
import Header from "@/components/Header";

export default function HomePage() {
  return (
    <div className="fixed inset-0 flex min-h-[100dvh] flex-col overflow-hidden overscroll-none bg-white">
      <Header />
      
      <main 
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{ 
          backgroundImage: 'url(/FPU-Img-Campus-13.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.42)' }}></div>
        
        <div className="relative z-10 w-full px-5 py-6 text-center sm:px-6 sm:py-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 md:mb-8 relative">
              <h1 className="mb-3 text-3xl font-bold uppercase text-fpuCyan sm:text-4xl md:text-5xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                MicroTransit Tracker
              </h1>
              <p className="text-base text-gray-100 sm:text-lg md:text-xl">
                Track your campus shuttle in real time
              </p>
            </div>

            <Link
              href="/map"
              className="inline-block px-8 py-3 bg-fpuCyan text-white rounded-lg font-semibold hover:scale-105 transition-transform"
            >
              Open Live Tracker
            </Link>

            <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 text-xs sm:mt-12 sm:grid-cols-3 sm:gap-4 sm:text-sm md:mt-16">
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

      <footer className="flex-shrink-0 border-t border-gray-100 bg-white py-2 md:py-3">
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

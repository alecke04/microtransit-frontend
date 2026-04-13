import Link from "next/link";
import Header from "@/components/Header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ 
          backgroundImage: 'url(/FPU-Img-Campus-13.jpg)',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Dark overlay covering entire background */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        <div className="relative z-10 w-full px-6 flex items-center justify-center">
          <div className="text-center max-w-2xl">
            <div className="mb-8">
              <h1 className="text-5xl font-bold mb-4 text-fpuCyan">
                MicroTransit Tracker
              </h1>
              <p className="text-xl text-gray-100 mb-2">
                Real-Time GPS Tracking for Florida Poly
              </p>
              <p className="text-gray-200">
                Live map updates every 2 seconds
              </p>
            </div>

            <Link
              href="/map"
              className="inline-block px-8 py-3 bg-fpuCyan text-white rounded-lg font-semibold hover:bg-fpuLight hover:shadow-lg transition-all transform hover:scale-105"
            >
              View Live Map
            </Link>

            <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto text-sm">
              <div>
                <div className="text-3xl mb-2 text-fpuCyan"></div>
                <p className="text-gray-100 font-medium">Real-Time Tracking</p>
              </div>
              <div>
                <div className="text-3xl mb-2 text-fpuCyan"></div>
                <p className="text-gray-100 font-medium">Historical Data</p>
              </div>
              <div>
                <div className="text-3xl mb-2 text-fpuCyan"></div>
                <p className="text-gray-100 font-medium">Live WebSocket</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="w-full px-6 text-center">
          <p className="text-sm text-gray-600">
            Made with <span className="text-fpuCyan font-semibold">Next.js</span> and <span className="text-fpuCyan font-semibold">FastAPI</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            © Florida Polytechnic University | MicroTransit Tracking System
          </p>
        </div>
      </footer>
    </>
  );
}

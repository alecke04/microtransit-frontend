import Link from "next/link";

import Header from "@/components/Header";

export default function HomePage() {
  return (
    <div className="home-shell fixed inset-0 flex min-h-[100dvh] flex-col overflow-hidden overscroll-none bg-white">
      <Header />

      <main
        className="home-main relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{
          backgroundImage: "url(/FPU-Img-Campus-13.jpg)",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(0, 0, 0, 0.42)" }} />

        <div className="home-content relative z-10 w-full px-5 py-6 text-center sm:px-6 sm:py-8">
          <div className="mx-auto max-w-2xl">
            <div className="relative mb-6 md:mb-8">
              <h1
                className="mb-3 text-3xl font-bold uppercase text-fpuCyan sm:text-4xl md:text-5xl"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
              >
                MicroTransit Tracker
              </h1>
              <p className="text-base text-gray-100 sm:text-lg md:text-xl">
                Never miss your next shuttle
              </p>
            </div>

            <Link
              href="/map"
              className="inline-block rounded-lg bg-fpuCyan px-8 py-3 font-semibold text-white transition-transform hover:scale-105"
            >
              Open Live Tracker
            </Link>

            <div className="home-features mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 text-xs sm:mt-12 sm:grid-cols-3 sm:gap-4 sm:text-sm md:mt-16">
              <div>
                <p className="font-medium text-gray-100">Real-Time Tracking</p>
              </div>
              <div>
                <p className="font-medium text-gray-100">Historical Data</p>
              </div>
              <div>
                <p className="font-medium text-gray-100">Live WebSocket</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="home-footer flex-shrink-0 border-t border-gray-100 bg-white py-2 md:py-3">
        <div className="w-full px-4 text-center">
          <p className="mb-1 text-[9px] leading-none text-gray-500 md:text-xs">
            Made with <span className="font-bold text-fpuCyan">Next.js</span> and{" "}
            <span className="font-bold text-fpuCyan">FastAPI</span>
          </p>
          <p className="text-[8px] uppercase leading-none tracking-tighter text-gray-400 md:text-[10px]">
            Florida Poly | MicroTransit System
          </p>
        </div>
      </footer>
    </div>
  );
}

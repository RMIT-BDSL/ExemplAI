import CourseList from "#/components/home/CourseList";
// import SidePanel from "#/components/home/SidePane";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

export const Route = createFileRoute("/_authenticated/")({ component: Home });

function Home() {
  return (
    <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Main Column: Centered Course List and Exercises */}
        <main>
          <Suspense
            fallback={
              <div className="space-y-6 animate-pulse">
                <div>
                  <div className="h-5 w-48 bg-zinc-200 rounded"></div>
                  <div className="h-4 w-72 bg-zinc-100 rounded mt-2"></div>
                </div>
                <div className="h-20 bg-zinc-200/50 rounded-xl border border-line"></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 bg-zinc-200/30 rounded-xl border border-line"
                    ></div>
                  ))}
                </div>
              </div>
            }
          >
            <CourseList />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

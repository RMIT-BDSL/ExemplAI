import CourseList from "#/components/home/CourseList";
// import SidePanel from "#/components/home/SidePane";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Column: Course List and Exercises */}
        <main className="lg:col-span-2">
          <Suspense
            fallback={
              <div className="space-y-6 animate-pulse">
                <div>
                  <div className="h-6 w-48 bg-zinc-200 rounded"></div>
                  <div className="h-4 w-72 bg-zinc-100 rounded mt-2"></div>
                </div>
                <div className="h-24 bg-zinc-200/50 rounded-xl border border-line"></div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 bg-zinc-200/30 rounded-xl border border-line"
                    ></div>
                  ))}
                </div>
              </div>
            }
          >
            <CourseList />
          </Suspense>
        </main>

        {/* Sidebar Column: User Profile and Stats */}
        {/* <aside className="lg:col-span-1 lg:sticky lg:top-8"> */}
        {/* <SidePanel /> */}
        {/* </aside> */}
      </div>
    </div>
  );
}

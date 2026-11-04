import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import CourseList, { SyllabusSkeleton } from "#/components/home/CourseList";
import { CurrentExercise } from "#/components/session/CurrentExercise";
import { useSessionExercises } from "#/components/session/SessionGate";

export const Route = createFileRoute("/_authenticated/")({ component: Home });

function Home() {
  // In a study session's exercises there's no syllabus, only the next exercise.
  if (useSessionExercises()) return <CurrentExercise />;
  return (
    <div className="xa-workspace min-h-[calc(100dvh-36px)] w-full px-6 py-10">
      <main className="mx-auto max-w-3xl">
        <Suspense fallback={<SyllabusSkeleton />}>
          <CourseList />
        </Suspense>
      </main>
    </div>
  );
}

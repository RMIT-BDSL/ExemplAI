import CourseList from '#/components/home/CourseList'
import SidePanel from '#/components/home/SidePane'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Column: Course List and Exercises */}
        <main className="lg:col-span-2">
          <CourseList />
        </main>

        {/* Sidebar Column: User Profile and Stats */}
        <aside className="lg:col-span-1 lg:sticky lg:top-8">
          <SidePanel />
        </aside>
      </div>
    </div>
  )
}

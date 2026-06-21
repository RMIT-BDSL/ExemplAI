import { Award, CheckCircle2, Clock, Flame, Shield, User } from "lucide-react"

export default function SidePane() {
  const weeklyActivity = [
    { day: "Mon", active: true },
    { day: "Tue", active: true },
    { day: "Wed", active: true },
    { day: "Thu", active: true },
    { day: "Fri", active: true },
    { day: "Sat", active: false },
    { day: "Sun", active: false },
  ]

  const recentLogs = [
    {
      id: "1",
      action: "Completed 'Valid Parentheses'",
      time: "2 hours ago",
      type: "success",
    },
    {
      id: "2",
      action: "Started 'Merge Two Sorted Lists'",
      time: "1 day ago",
      type: "progress",
    },
    {
      id: "3",
      action: "Completed 'Two Sum'",
      time: "2 days ago",
      type: "success",
    },
  ]

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <div className="island-shell rounded-xl p-5 border border-line">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lagoon/20 border border-lagoon/30 text-lagoon-deep">
            <User className="size-6" />
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-palm text-[10px] font-bold text-white">
              2
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg text-sea-ink leading-tight">Guest Learner</h3>
            <p className="text-xs text-sea-ink-soft flex items-center gap-1 mt-0.5">
              <Shield className="size-3 text-lagoon-deep" />
              <span>Python Novice</span>
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-sea-ink">
              <span className="bg-lagoon/10 text-lagoon-deep px-2 py-0.5 rounded border border-lagoon/20">
                Level 2
              </span>
              <span className="text-sea-ink-soft">
                350 / 600 XP
              </span>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="w-full bg-sand/60 rounded-full h-1.5 mt-4 overflow-hidden border border-line">
          <div className="bg-lagoon-deep h-1.5 rounded-full" style={{ width: "58%" }} />
        </div>
      </div>

      {/* Streak Panel */}
      <div className="island-shell rounded-xl p-5 border border-line">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sea-ink-soft flex items-center gap-1.5">
            <Flame className="size-4 text-orange-500" />
            <span>Daily Streak</span>
          </h4>
          <span className="text-sm font-extrabold text-orange-600">5 Days 🔥</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weeklyActivity.map((d) => (
            <div key={d.day} className="space-y-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold mx-auto border ${
                  d.active
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-600"
                    : "bg-sand/30 border-line text-sea-ink-soft/40"
                }`}
              >
                {d.day[0]}
              </div>
              <p className="text-[9px] font-medium text-sea-ink-soft">{d.day}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Progress Metrics */}
      <div className="island-shell rounded-xl p-5 border border-line">
        <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sea-ink-soft flex items-center gap-1.5">
            <Award className="size-4 text-lagoon-deep" />
            <span>Weekly Progress</span>
          </h4>
          <span className="text-xs font-bold text-sea-ink">Week 2</span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-medium text-sea-ink mb-1">
              <span>Exercises Solved</span>
              <span className="font-semibold">2 / 5</span>
            </div>
            <div className="w-full bg-sand/60 rounded-full h-2 overflow-hidden border border-line">
              <div className="bg-palm h-2 rounded-full" style={{ width: "40%" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-sand/40 border border-line rounded-lg p-2.5 text-center">
              <p className="text-xs text-sea-ink-soft font-medium">Acceptance Rate</p>
              <p className="text-lg font-bold text-sea-ink mt-0.5">85.4%</p>
            </div>
            <div className="bg-sand/40 border border-line rounded-lg p-2.5 text-center">
              <p className="text-xs text-sea-ink-soft font-medium">Estimated Time</p>
              <p className="text-lg font-bold text-sea-ink mt-0.5">45 min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Log */}
      <div className="island-shell rounded-xl p-5 border border-line">
        <h4 className="text-xs font-bold uppercase tracking-wider text-sea-ink-soft mb-3">
          Recent Activity
        </h4>
        <div className="space-y-3">
          {recentLogs.map((log) => (
            <div key={log.id} className="flex gap-2.5 text-xs text-sea-ink leading-normal">
              {log.type === "success" ? (
                <CheckCircle2 className="size-4 text-palm shrink-0 mt-0.5" />
              ) : (
                <Clock className="size-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sea-ink">{log.action}</p>
                <p className="text-[10px] text-sea-ink-soft mt-0.5">{log.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
import type { GenericId as Id } from 'convex/values';

// Shapes returned by web/convex/students.ts.

export type ExampleMode = 'complete' | 'faded' | 'erroneous';
export type ReplyMode = ExampleMode | 'control' | 'blocked';
export type LessonStatus = 'pending' | 'in-progress' | 'completed';

// Tutor replies by who wrote them: an example node, the normal (control)
// tutor, the guardrail, or an unrecognised model.
export type ReplyKind = ReplyMode | 'other';
export type ReplyCounts = Record<ReplyKind, number>;
// Which tutor a student has been getting, from their replies.
export type TutorGroup = 'examples' | 'control' | 'mixed';

export interface BandStat {
  band: ExampleMode;
  lessons: number;
  firstTry: number;
}

export interface LessonSnapshot {
  lessonId: Id<'questions'>;
  name: string;
  week: number;
  topic: string | null;
  kc: string | null;
  status: LessonStatus;
  failedSubmits: number;
  mastery: number | null;
  mode: ExampleMode | null;
  examples: { used: number; cap: number; remaining: number };
  lastReply: { mode: ReplyMode | null; responseType: string | null; at: number } | null;
  lastMessageAt: number | null;
}

export interface StudentRow {
  userId: Id<'users'>;
  name: string | null;
  email: string | null;
  joinedAt: number;
  lastActivityAt: number | null;
  current: LessonSnapshot | null;
  started: number;
  submitted: number;
  completed: number;
  firstTry: number;
  firstTryRate: number | null;
  overallMastery: number | null;
  topicsMastered: number;
  topicsTracked: number;
  replies: ReplyCounts;
  tutor: TutorGroup | null;
}

export interface StudentSummary {
  students: number;
  active: number;
  submitted: number;
  firstTry: number;
  firstTryRate: number | null;
  activeThisWeek: number;
  // activeThisWeek stopped counting at the server's cap.
  activeThisWeekCapped: boolean;
  topicsMastered: number;
  firstTryByBand: BandStat[];
  replies: ReplyCounts;
}

export interface LessonRow {
  lessonId: Id<'questions'>;
  name: string;
  week: number;
  topic: string | null;
  kc: string | null;
  courseName: string | null;
  status: LessonStatus;
  failedSubmits: number;
  submitted: boolean;
  firstTry: boolean;
  examplesGiven: number;
  mastery: number | null;
  masteryBefore: number | null;
  lastActivityAt: number | null;
}

export interface TopicRow {
  kc: string;
  topic: string | null;
  mastery: number;
  mode: ExampleMode;
  mastered: boolean;
  masteredAt: number | null;
  updatedAt: number;
  lessons: number;
  completed: number;
  submitted: number;
  firstTry: number;
}

export interface WeekRow {
  week: number;
  lessons: number;
  started: number;
  completed: number;
  submitted: number;
  firstTry: number;
  mastery: number | null;
  topics: string[];
}

export interface ActivityItem {
  at: number;
  kind: 'started' | 'submitted' | 'completed' | 'mastered' | 'help' | 'example';
  lessonId: Id<'questions'> | null;
  lessonName: string | null;
  detail: string | null;
}

export interface StudentDetail {
  student: {
    userId: Id<'users'>;
    name: string | null;
    email: string | null;
    joinedAt: number;
    invitationCode: string | null;
  };
  current: LessonSnapshot | null;
  totals: {
    lessons: number;
    started: number;
    completed: number;
    submitted: number;
    firstTry: number;
    firstTryRate: number | null;
    overallMastery: number | null;
    topicsMastered: number;
    topicsTracked: number;
    examplesGiven: number;
    replies: ReplyCounts;
    tutor: TutorGroup | null;
  };
  firstTryByBand: BandStat[];
  lessons: LessonRow[];
  topics: TopicRow[];
  weeks: WeekRow[];
  activity: ActivityItem[];
}

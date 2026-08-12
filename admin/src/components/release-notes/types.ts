export type ReleaseNoteType = "feature" | "fix" | "improvement";

export type ReleaseNote = {
  _id: string;
  type: ReleaseNoteType;
  timestamp: number;
  title: string;
  content: string;
};

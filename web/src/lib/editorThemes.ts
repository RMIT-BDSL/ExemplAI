// Monaco themes built from the workspace tokens (styles.css --xa-*).
// Monaco needs literal hex values, so keep these in step with the tokens.
export const EDITOR_THEMES = {
  exemplaiLight: {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8a8580", fontStyle: "italic" },
      { token: "keyword", foreground: "8a6420", fontStyle: "bold" },
      { token: "string", foreground: "3c6f50" },
      { token: "number", foreground: "8a6420" },
      { token: "operator", foreground: "5f5b64" },
    ],
    colors: {
      "editor.background": "#fbf9f4",
      "editor.foreground": "#1c1b1f",
      "editorLineNumber.foreground": "#a39d93",
      "editorLineNumber.activeForeground": "#8a6420",
      "editor.lineHighlightBackground": "#f0e7d4",
      "editor.lineHighlightBorder": "#00000000",
      "editorGutter.background": "#fbf9f4",
      "editorCursor.foreground": "#8a6420",
      "editor.selectionBackground": "#e9dcc0",
      "editor.inactiveSelectionBackground": "#f0e7d4",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#d8d2c766",
      "scrollbarSlider.hoverBackground": "#c9c1b399",
      "scrollbarSlider.activeBackground": "#b8ae9ebb",
    },
  },
  exemplaiDark: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e6d73", fontStyle: "italic" },
      { token: "keyword", foreground: "c29a53", fontStyle: "bold" },
      { token: "string", foreground: "769480" },
      { token: "number", foreground: "b89053" },
      { token: "operator", foreground: "9f9da4" },
    ],
    colors: {
      "editor.background": "#141318",
      "editor.foreground": "#eaeaea",
      "editorLineNumber.foreground": "#4f4d54",
      "editorLineNumber.activeForeground": "#c29a53",
      "editor.lineHighlightBackground": "#1e1d24",
      "editor.lineHighlightBorder": "#00000000",
      "editorGutter.background": "#141318",
      "editorCursor.foreground": "#c29a53",
      "editor.selectionBackground": "#282630",
      "editor.inactiveSelectionBackground": "#1e1d24",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#3a384166",
      "scrollbarSlider.hoverBackground": "#4a485299",
      "scrollbarSlider.activeBackground": "#5a5862bb",
    },
  },
} as const;

export function defineEditorThemes(monaco: any) {
  for (const [name, theme] of Object.entries(EDITOR_THEMES)) {
    monaco.editor.defineTheme(name, theme);
  }
}

/** The Monaco theme name for the app's light or dark mode. */
export const editorThemeFor = (resolved: string | undefined) =>
  resolved === "dark" ? "exemplaiDark" : "exemplaiLight";

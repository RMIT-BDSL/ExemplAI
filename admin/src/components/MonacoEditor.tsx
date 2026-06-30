import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import loader from '@monaco-editor/loader';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (val: string) => void;
  height?: string;
  theme?: string;
}

export const MonacoEditor: Component<MonacoEditorProps> = (props) => {
  let editorContainer!: HTMLDivElement;
  let editorInstance: any = null;

  // Convert course language text to Monaco editor syntax support names
  const getMonacoLanguage = (lang: string) => {
    const l = lang.trim().toLowerCase();
    if (l.includes('python')) return 'python';
    if (l.includes('javascript') || l === 'js') return 'javascript';
    if (l.includes('typescript') || l === 'ts') return 'typescript';
    if (l.includes('c++') || l === 'cpp') return 'cpp';
    if (l.includes('java')) return 'java';
    if (l.includes('go')) return 'go';
    if (l.includes('rust')) return 'rust';
    if (l.includes('sql')) return 'sql';
    if (l.includes('html') || l.includes('css')) return 'html';
    return 'plaintext';
  };

  onMount(async () => {
    try {
      const monaco = await loader.init();
      editorInstance = monaco.editor.create(editorContainer, {
        value: props.value,
        language: getMonacoLanguage(props.language),
        theme: props.theme || 'vs-dark',
        minimap: { enabled: false },
        automaticLayout: true,
        fontFamily: "'Fira Code', Menlo, Monaco, 'Courier New', monospace",
        fontSize: 13,
        lineHeight: 18,
        padding: { top: 8, bottom: 8 },
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10
        }
      });

      editorInstance.onDidChangeModelContent(() => {
        const val = editorInstance.getValue();
        props.onChange(val);
      });
    } catch (err) {
      console.error('Failed to load Monaco editor:', err);
    }
  });

  createEffect(() => {
    const val = props.value;
    if (editorInstance && editorInstance.getValue() !== val) {
      editorInstance.setValue(val);
    }
  });

  createEffect(() => {
    const rawLang = props.language;
    if (editorInstance) {
      const model = editorInstance.getModel();
      if (model) {
        // Retrieve global monaco from window or import
        loader.init().then((monaco) => {
          monaco.editor.setModelLanguage(model, getMonacoLanguage(rawLang));
        }).catch((err) => console.error(err));
      }
    }
  });

  onCleanup(() => {
    if (editorInstance) {
      editorInstance.dispose();
    }
  });

  return (
    <div
      ref={editorContainer}
      style={{ height: props.height || '260px', width: '100%' }}
      class="rounded border border-white/10 overflow-hidden"
    />
  );
};

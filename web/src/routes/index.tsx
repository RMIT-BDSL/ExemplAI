import { useRef, useEffect } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import Editor from '@monaco-editor/react'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  // get the user submitted value
  const editorRef = useRef(null);
  const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'

  console.log('Backend URL:', url);


  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
  }

  function showValue() {
    // this is the code to be submitted.

    const submissionCode = editorRef.current.getValue()
    alert(submissionCode) // for testing, you can remove this later

    // send the code to backend
    // let result = await 
    //
    // console.log(result);

  }
  return (
    <ClientOnly>
      {/* <> */}
      <Editor onMount={handleEditorDidMount} height="90vh" defaultLanguage="javascript" defaultValue="// some comment" />
      <Button onClick={showValue}>Submit code</Button>
      {/* </> */}
    </ClientOnly>
  )
}

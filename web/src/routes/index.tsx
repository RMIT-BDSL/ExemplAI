import { useRef, useEffect } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import Editor from '@monaco-editor/react'
import { Button } from '#/components/ui/button'
import axios from 'axios'
import CodeEditor from '#/components/student/CodeEditor'
import CodingBar from '#/components/student/InteractionBar'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  // // get the user submitted value
  // const editorRef = useRef(null);
  // const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'

  // console.log('Backend URL:', url);


  // function handleEditorDidMount(editor, monaco) {
  //   editorRef.current = editor;
  // }

  // async function showValue() {
  //   // this is the code to be submitted.

  //   const submissionCode = editorRef.current.getValue()
  //   // alert(submissionCode) // for testing, you can remove this later

  //   // send the code to backend
  //   let result = await axios.post(`${url}/execute`, {
  //     code: submissionCode
  //   });
  //   // console.log(result);

  // }
  // return (
  //   <ClientOnly>
  //     {/* <> */}
  //     <Editor onMount={handleEditorDidMount} height="90vh" defaultLanguage="javascript" defaultValue="// some comment" />
  //     <Button onClick={showValue}>Submit code</Button>
  //     {/* </> */}
  //   </ClientOnly>
  // )

  const editorRef = useRef(null);
  const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
  }
  async function handleSubmit() {
    // this is the code to be submitted.
    if (!editorRef.current) return;


    const submissionCode = editorRef.current.getValue()
    // alert(submissionCode) // for testing, you can remove this later

    // send the code to backend
    await axios.post(`${url}/execute`, {
      code: submissionCode
    }).then(
      async function (response) {
        let output = response.data;
        console.log(output);
      }
    );
  }

  return (
    <>
      <CodingBar onSubmit={handleSubmit} />
      <CodeEditor onMount={handleEditorMount} />
    </>
  )
}

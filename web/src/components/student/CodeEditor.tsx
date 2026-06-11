import { Editor } from "@monaco-editor/react";
import { ClientOnly } from "@tanstack/react-router";
import axios from "axios";
import { useRef } from "react";
import { Button } from "../ui/button";


export default function CodeEditor({ onMount }: { onMount: (editor: any, monaco: any) => void }) {
    return (
        <ClientOnly>
            {/* <> */}
            <Editor onMount={onMount} height="90vh" defaultLanguage="javascript" defaultValue="// some comment" />
            {/* TODO: refactor Button to custom submit bar */}
            {/* <Button onClick={showValue}>Submit code</Button> */}
            {/* </> */}
        </ClientOnly>
    )
}
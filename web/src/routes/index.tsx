import { useRef, useState } from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import axios from 'axios'
import { BookOpen, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'
import CodeEditor from '#/components/student/CodeEditor'
import CodingBar from '#/components/student/InteractionBar'
import ResetCodeForm from '#/components/student/ResetCodeForm'
import SidePanel from '#/components/student/SidePane'
import Problem from '#/components/student/problem/Problem'

export const Route = createFileRoute('/')({ component: Home })


function Home() {
  return (
    <div>Hello world</div>
  )
}

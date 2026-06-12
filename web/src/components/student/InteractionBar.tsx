import { useState, useRef, useEffect } from 'react'
import { RotateCcw, Settings, ChevronDown, Check, Code } from 'lucide-react'

interface CodingBarProps {
  language: string
  setLanguage: (lang: string) => void
  fontSize: number
  setFontSize: (size: number) => void
  onResetClick: () => void
}

const LANGUAGES = [
  { id: 'python', name: 'Python 3' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'cpp', name: 'C++' },
  { id: 'java', name: 'Java' },
]

const FONT_SIZES = [12, 14, 16, 18]

export default function CodingBar({
  language,
  setLanguage,
  fontSize,
  setFontSize,
  onResetClick,
}: CodingBarProps) {
  const [isLangOpen, setIsLangOpen] = useState(false)
  const [isFontOpen, setIsFontOpen] = useState(false)

  const langRef = useRef<HTMLDivElement>(null)
  const fontRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false)
      }
      if (fontRef.current && !fontRef.current.contains(event.target as Node)) {
        setIsFontOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLanguageName = LANGUAGES.find((l) => l.id === language)?.name || 'Python 3'

  return (
    <div className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-4 text-sm text-zinc-300">
      {/* Left controls */}
      <div className="flex items-center gap-3">
        {/* Mock Quest File Tab */}
        <div className="flex items-center gap-2 rounded-t-lg bg-zinc-950/80 px-3 py-1.5 text-xs font-semibold text-emerald-500 border border-zinc-800 border-b-transparent">
          <Code className="size-3.5" />
          <span>solution.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'cpp' ? 'cpp' : 'java'}</span>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Language dropdown */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-1.5 rounded-md bg-zinc-800/60 px-3 py-1.5 text-xs font-medium hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <span>{currentLanguageName}</span>
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLangOpen && (
            <div className="absolute left-0 mt-1.5 z-45 w-40 rounded-md border border-zinc-800 bg-slate-900 py-1 shadow-lg">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => {
                    setLanguage(lang.id)
                    setIsLangOpen(false)
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                >
                  <span>{lang.name}</span>
                  {language === lang.id && <Check className="size-3.5 text-emerald-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset Code Button */}
        <button
          onClick={onResetClick}
          title="Reset code template"
          className="flex size-7 items-center justify-center rounded-md bg-zinc-800/40 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Autosave Status */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Autosaved to Cloud</span>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Settings / Font Size dropdown */}
        <div className="relative" ref={fontRef}>
          <button
            onClick={() => setIsFontOpen(!isFontOpen)}
            className="flex items-center gap-1.5 rounded-md bg-zinc-800/40 px-2.5 py-1.5 text-xs hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            title="Editor Settings"
          >
            <Settings className="size-3.5" />
            <span className="text-[10px] text-zinc-500">Size: {fontSize}px</span>
            <ChevronDown className="size-3" />
          </button>

          {isFontOpen && (
            <div className="absolute right-0 mt-1.5 z-45 w-36 rounded-md border border-zinc-800 bg-slate-900 p-2 shadow-lg">
              <span className="block px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                Font Size
              </span>
              <div className="h-px bg-zinc-800 mb-1" />
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setFontSize(size)
                    setIsFontOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                >
                  <span>{size}px</span>
                  {fontSize === size && <Check className="size-3.5 text-emerald-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
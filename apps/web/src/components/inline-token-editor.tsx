import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react"
import { TOKEN_DRAG_TYPE, tokenLabel } from "../lib/naming-tokens"

export type InlineTokenEditorHandle = {
  insertToken: (name: string) => void
  focus: () => void
}

type DocumentWithCaret = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replaceAll("\u00a0", " ")
  }
  if (node instanceof HTMLElement) {
    if (node.dataset.token) return `{${node.dataset.token}}`
    if (node.tagName === "BR") return ""
    return Array.from(node.childNodes).map(serializeNode).join("")
  }
  return ""
}

function createChip(name: string) {
  const chip = document.createElement("span")
  chip.dataset.token = name
  chip.contentEditable = "false"
  chip.title = `{${name}}`
  chip.className =
    "mx-0.5 inline-flex select-none items-center rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 align-middle text-[11px] font-medium leading-4 text-gray-700"
  chip.textContent = tokenLabel(name)
  return chip
}

export const InlineTokenEditor = forwardRef<
  InlineTokenEditorHandle,
  {
    value: string
    onChange: (value: string) => void
    onFocus?: () => void
    placeholder?: string
    ariaLabel?: string
  }
>(function InlineTokenEditor(
  { value, onChange, onFocus, placeholder = "Build a path…", ariaLabel = "Path template" },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const serializedRef = useRef<string | null>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const render = (next: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.replaceChildren()
    for (const piece of next.split(/(\{[a-zA-Z0-9_]+\})/g)) {
      if (!piece) continue
      const token = /^\{([a-zA-Z0-9_]+)\}$/.exec(piece)
      if (token) {
        editor.appendChild(createChip(token[1]))
      } else {
        editor.appendChild(document.createTextNode(piece))
      }
    }
  }

  useEffect(() => {
    if (!editorRef.current) return
    if (value === serializedRef.current) return
    render(value)
    serializedRef.current = value
    savedRangeRef.current = null
  }, [value])

  const sync = () => {
    const editor = editorRef.current
    if (!editor) return
    const next = serializeNode(editor)
    serializedRef.current = next
    onChange(next)
  }

  const saveSelection = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }

  const rangeFromPoint = (x: number, y: number) => {
    const editor = editorRef.current
    if (!editor) return null
    const documentWithCaret = document as DocumentWithCaret
    let range: Range | null = null
    if (documentWithCaret.caretRangeFromPoint) {
      range = documentWithCaret.caretRangeFromPoint(x, y)
    } else if (documentWithCaret.caretPositionFromPoint) {
      const position = documentWithCaret.caretPositionFromPoint(x, y)
      if (position) {
        range = document.createRange()
        range.setStart(position.offsetNode, position.offset)
        range.collapse(true)
      }
    }
    if (!range || !editor.contains(range.startContainer)) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      return range
    }
    const startElement =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement
    const chip = startElement?.closest("[data-token]")
    if (chip) {
      range = document.createRange()
      range.setStartAfter(chip)
      range.collapse(true)
    }
    return range
  }

  const insertAtRange = (name: string, range: Range) => {
    const editor = editorRef.current
    if (!editor) return
    const chip = createChip(name)
    range.deleteContents()
    range.insertNode(chip)
    const after = document.createRange()
    after.setStartAfter(chip)
    after.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(after)
    savedRangeRef.current = after.cloneRange()
    sync()
  }

  const insertToken = (name: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    let range = savedRangeRef.current
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    insertAtRange(name, range)
  }

  useImperativeHandle(ref, () => ({
    insertToken,
    focus: () => editorRef.current?.focus(),
  }))

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const name = event.dataTransfer.getData(TOKEN_DRAG_TYPE)
    if (!name) return
    event.preventDefault()
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const range = rangeFromPoint(event.clientX, event.clientY)
    if (range) insertAtRange(name, range)
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ")
    document.execCommand("insertText", false, text)
  }

  return (
    <div className="relative">
      <div
        ref={editorRef}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="false"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={sync}
        onFocus={() => {
          saveSelection()
          onFocus?.()
        }}
        onBlur={saveSelection}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter") event.preventDefault()
          saveSelection()
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(TOKEN_DRAG_TYPE)) {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
          }
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className="min-h-10 w-full whitespace-pre-wrap break-words rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-card outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
      />
      {!value ? (
        <span className="pointer-events-none absolute left-2.5 top-2 text-sm text-gray-400">
          {placeholder}
        </span>
      ) : null}
    </div>
  )
})

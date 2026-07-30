import { useState, type ReactNode } from 'react'

interface HoverPreviewProps {
  children: ReactNode
  title: string
  imageUrl?: string
  flavourText?: string
  implicitMods?: string[]
  explicitMods?: string[]
}

export function HoverPreview({
  children,
  title,
  imageUrl,
  flavourText,
  implicitMods,
  explicitMods,
}: HoverPreviewProps) {
  const [hover, setHover] = useState(false)
  const hasContent = Boolean(imageUrl || flavourText || implicitMods?.length || explicitMods?.length)

  if (!hasContent) return <>{children}</>

  return (
    <span
      className="relative inline-block cursor-default border-b border-dotted border-neutral-600"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {hover && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-neutral-700 bg-neutral-950 p-3 text-left shadow-xl">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              className="mb-2 max-h-48 w-full rounded object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <div className="mb-1 text-sm font-semibold text-neutral-100">{title}</div>
          {implicitMods?.map((mod, i) => (
            <div key={`i${i}`} className="text-xs text-sky-300">
              {mod}
            </div>
          ))}
          {explicitMods?.map((mod, i) => (
            <div key={`e${i}`} className="text-xs text-neutral-300">
              {mod}
            </div>
          ))}
          {flavourText && (
            <div className="mt-2 whitespace-pre-line text-xs italic text-neutral-500">{flavourText}</div>
          )}
        </div>
      )}
    </span>
  )
}

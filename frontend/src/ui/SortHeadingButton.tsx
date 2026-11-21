import type { ReactNode } from 'react'
import './sort-heading-button.css'

export function SortHeadingButton({ children, direction, disabled, onClick, 'aria-label': label }: {
  children: ReactNode
  direction?: 'ascending' | 'descending'
  disabled?: boolean
  onClick: () => void
  'aria-label': string
}) {
  return <button type="button" className="sort-heading-button" data-direction={direction} disabled={disabled} onClick={onClick} aria-label={label}>
    {children}
    <span className="sort-heading-indicator" aria-hidden="true">
      <svg width={12} height={14} viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="m3.5 5.5 2.5-2.5 2.5 2.5" />
        <path d="m3.5 8.5 2.5 2.5 2.5-2.5" />
      </svg>
    </span>
  </button>
}

import type { CSSProperties, SVGProps } from 'react'
import type { ResourceKind } from '../core/types'

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  style?: CSSProperties
  className?: string
}

const defaultProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconLogo({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function IconOverview({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function IconMedia({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function IconTag({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

export function IconBrand({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}

export function IconCategory({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function IconCollection({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

export function IconProduct({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

export function IconVariant({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

export function IconOperations({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export function IconSettings({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconUpload({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export function IconFolderOpen({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M2 11h20M2 7a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1H2V7z" />
      <path d="M3.5 21h17a1.5 1.5 0 0 0 1.45-1.9l-1.8-7.2a1.5 1.5 0 0 0-1.45-1.1H5.3a1.5 1.5 0 0 0-1.45 1.1l-1.8 7.2A1.5 1.5 0 0 0 3.5 21z" />
    </svg>
  )
}

export function IconCheck({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconCheckCircle({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export function IconAlertCircle({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function IconXCircle({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

export function IconClock({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function IconPlay({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

export function IconRefresh({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export function IconArrowRight({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export function IconChevronRight({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function IconTrash({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function IconCopy({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function IconFileText({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

export function IconCamera({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export function IconClose({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconWorkflow({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v3a3 3 0 0 0 3 3h3" />
      <path d="M18 9v3a3 3 0 0 1-3 3" />
    </svg>
  )
}

export function IconPlus({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconDownload({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function IconLayout({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

export function IconLink({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export function IconUnlink({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...defaultProps} {...props}>
      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export function ResourceIcon({ kind, size = 18, ...props }: IconProps & { kind: ResourceKind }) {
  switch (kind) {
    case 'tags':
      return <IconTag size={size} {...props} />
    case 'brands':
      return <IconBrand size={size} {...props} />
    case 'categories':
      return <IconCategory size={size} {...props} />
    case 'collections':
      return <IconCollection size={size} {...props} />
    case 'products':
      return <IconProduct size={size} {...props} />
    case 'variants':
      return <IconVariant size={size} {...props} />
    default:
      return null
  }
}

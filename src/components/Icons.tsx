import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

function Dot({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r="1.3" fill="currentColor" stroke="none" />
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M5 12l6-6M5 12l6 6" />
    </IconBase>
  )
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
    </IconBase>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  )
}

export function CheckboxIcon({
  checked,
  ...props
}: IconProps & { checked: boolean }) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      {checked && <path d="M9 12l2 2 4-4" />}
    </IconBase>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 9l6 6 6-6" />
    </IconBase>
  )
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 15l6-6 6 6" />
    </IconBase>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </IconBase>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Dot cx={9} cy={6} />
      <Dot cx={9} cy={12} />
      <Dot cx={9} cy={18} />
      <Dot cx={15} cy={6} />
      <Dot cx={15} cy={12} />
      <Dot cx={15} cy={18} />
    </IconBase>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Dot cx={5} cy={12} />
      <Dot cx={12} cy={12} />
      <Dot cx={19} cy={12} />
    </IconBase>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4v16l13-8z" />
    </IconBase>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </IconBase>
  )
}

export function RestartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </IconBase>
  )
}

interface GemIconProps {
  className?: string
}

export default function GemIcon({ className }: GemIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Crown — gold */}
      <path d="M12 2L18.5 8H5.5L12 2Z" fill="#f5c518" />
      {/* Crown left highlight — lighter gold */}
      <path d="M12 2L8 8H5.5L12 2Z" fill="#fde68a" opacity="0.55" />
      {/* Pavilion main — violet */}
      <path d="M5.5 8L12 21L18.5 8H5.5Z" fill="#8b5cf6" />
      {/* Pavilion centre facet — darker violet */}
      <path d="M8.5 8L12 21L15.5 8H8.5Z" fill="#7c3aed" />
      {/* Keel — deepest */}
      <path d="M10.5 8L12 21L13.5 8H10.5Z" fill="#6d28d9" />
    </svg>
  )
}

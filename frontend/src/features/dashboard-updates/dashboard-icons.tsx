export function DashboardIcon({
  name,
  className = 'h-4 w-4',
  ...props
}: React.SVGProps<SVGSVGElement> & {
  name:
    | 'chart'
    | 'message'
    | 'chevronDown'
    | 'chevronRight'
    | 'sparkle'
    | 'x';
}) {
  const paths = {
    chart: (
      <>
        <line x1="3" y1="20" x2="21" y2="20" />
        <rect x="5" y="10" width="3" height="10" />
        <rect x="10.5" y="6" width="3" height="14" />
        <rect x="16" y="13" width="3" height="7" />
      </>
    ),
    message: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    sparkle: (
      <>
        <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </>
    ),
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

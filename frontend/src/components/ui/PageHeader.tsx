export default function PageHeader({
  icon,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: string
  title: string
  subtitle: string
  action?: string
  onAction?: () => void
}) {
  return (
    <section className="border-b border-outline-variant bg-white px-6 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-green-900 text-white">
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-normal text-green-950">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        {action ? (
          <button onClick={onAction} className="inline-flex items-center justify-center gap-2 rounded bg-green-900 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <span className="material-symbols-outlined text-lg">add_circle</span>
            {action}
          </button>
        ) : null}
      </div>
    </section>
  )
}

type SectionProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function Section({ title, action, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

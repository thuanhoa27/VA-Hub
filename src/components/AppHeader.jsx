import Link from 'next/link';

/**
 * Header dung chung cho ca trang phan tich va trang /runs.
 * Truoc day header nam trong shell.html; tach ra day de co nav sang /runs.
 * Style bang Tailwind (khong dung .top cua engine.css nua) nhung giu y nguyen
 * hinh thuc: nen trang, chu charcoal, vach do 3px duoi chan.
 */
export default function AppHeader({ current = 'analyze' }) {
  const tab = (href, key, label) => (
    <Link
      key={key}
      href={href}
      className={
        'px-3 py-1.5 rounded-md text-[13px] font-semibold no-underline transition-colors ' +
        (current === key
          ? 'bg-op-blueD text-white'
          : 'text-op-ink2 hover:bg-op-blueL hover:text-op-blueD')
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-op-line bg-white px-7 shadow-sm after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-op-red after:content-['']">
      <div className="flex items-center">
        <span className="mr-4 flex items-center gap-px">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="10.2" fill="none" stroke="#C51B1E" strokeWidth="4.6" />
            <circle cx="13" cy="13" r="3.5" fill="#C51B1E" />
          </svg>
          <span className="text-[22px] font-extrabold leading-none tracking-[-0.4px] text-op-ink">
            nPoint
          </span>
        </span>
        <span className="mr-4 h-[26px] w-px bg-op-line" />
        <span className="text-[17px] font-bold text-op-ink">Brand Hunt &amp; Tier Analyzer</span>
      </div>

      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1">
          {tab('/', 'analyze', 'Analyze')}
          {tab('/runs', 'runs', 'Run History')}
        </nav>
        <span className="ml-3 text-[12.5px] text-op-ink2">Health · Vietnam</span>
      </div>
    </header>
  );
}

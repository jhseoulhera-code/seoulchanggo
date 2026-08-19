import { quickNavItems } from "@/data/quickNav";

export function QuickNav() {
  return (
    <nav className="border-b border-border bg-background">
      <ul className="flex gap-5 overflow-x-auto px-4 py-3 md:px-6">
        {quickNavItems.map((item) => (
          <li key={item.label} className="flex-shrink-0">
            <a
              href={item.href}
              className="text-sm font-medium whitespace-nowrap text-text-main"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

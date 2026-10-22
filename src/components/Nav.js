"use client"; // uses the browser URL to highlight the current page

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/agent", label: "Voice Agent" },
  { href: "/knowledge", label: "Knowledge" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <span className="logo">🎙️ Voice CRM</span>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={"link" + (path === l.href ? " active" : "")}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
import { locales } from "@/i18n/config";
import { useI18n } from "@/components/i18n-provider";

export function Navigation() {
  const { t, locale } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/features/", label: t("nav.features") as string },
    { href: "/use-cases/", label: t("nav.useCases") as string },
    { href: "/pricing/", label: t("nav.pricing") as string },
    { href: "/blog/", label: t("nav.blog") as string },
  ];

  // Build href with locale prefix
  const getHref = (path: string) => {
    return `/${locale}${path}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href={getHref("/")} className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">Inspira</span>
          <span className="text-muted-foreground">DB</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={getHref(item.href)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="hidden md:flex items-center gap-4">
          {/* Language Switcher */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            {locales.map((l, index) => (
              <span key={l}>
                <Link
                  href={`/${l}/`}
                  className={`hover:text-foreground transition-colors ${
                    l === locale ? "font-medium text-foreground" : ""
                  }`}
                >
                  {l === "en" ? "EN" : "中文"}
                </Link>
                {index < locales.length - 1 && <span className="mx-1">|</span>}
              </span>
            ))}
          </div>

          <Button asChild>
            <Link href={getHref("/download/")}>
              {t("nav.download") as string}
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <div className="container py-4 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={getHref(item.href)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
              <Globe className="h-4 w-4" />
              {locales.map((l) => (
                <Link
                  key={l}
                  href={`/${l}/`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={l === locale ? "font-medium text-foreground" : ""}
                >
                  {l === "en" ? "English" : "中文"}
                </Link>
              ))}
            </div>
            <Button asChild className="w-full">
              <Link
                href={getHref("/download/")}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("nav.download") as string}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

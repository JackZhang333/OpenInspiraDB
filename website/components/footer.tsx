"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { defaultLocale } from "@/i18n/config";

export function Footer() {
  const { t, locale } = useI18n();
  const isDefaultLocale = locale === defaultLocale;

  const getHref = (path: string) => isDefaultLocale ? path : `/${locale}${path}`;

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href={getHref("/")} className="flex items-center gap-2 font-bold text-xl mb-4">
              <span className="text-primary">Inspira</span>
              <span className="text-muted-foreground">DB</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("footer.tagline") as string}
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.links.product") as string}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href={getHref("/features/")} className="hover:text-foreground">Features</Link></li>
              <li><Link href={getHref("/use-cases/")} className="hover:text-foreground">Use Cases</Link></li>
              <li><Link href={getHref("/pricing/")} className="hover:text-foreground">Pricing</Link></li>
              <li><Link href={getHref("/download/")} className="hover:text-foreground">Download</Link></li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.links.company") as string}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href={getHref("/blog/")} className="hover:text-foreground">Blog</Link></li>
              <li><Link href={getHref("/contact/")} className="hover:text-foreground">Contact</Link></li>
              <li><Link href={getHref("/about/")} className="hover:text-foreground">About</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
          {t("footer.copyright") as string}
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function CTASection() {
  const { t, locale } = useI18n();

  const getHref = (path: string) => `/${locale}${path}`;

  return (
    <section className="py-24">
      <div className="container">
        <div className="max-w-4xl mx-auto text-center bg-primary text-primary-foreground rounded-2xl p-12 md:p-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("hero.titleHighlight") as string}
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            {t("hero.subtitle") as string}
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href={getHref("/download/")}>
              {t("hero.ctaPrimary") as string}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

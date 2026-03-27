"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, Search, Shield, Zap } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { defaultLocale } from "@/i18n/config";

export function HeroSection() {
  const { t, locale } = useI18n();
  const isDefaultLocale = locale === defaultLocale;

  const getHref = (path: string) => isDefaultLocale ? path : `/${locale}${path}`;

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />

      <div className="container relative py-24 md:py-32 lg:py-40">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <Badge variant="secondary" className="mb-6">
            {t("hero.badge") as string}
          </Badge>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {t("hero.title") as string}
            <br />
            <span className="text-primary">{t("hero.titleHighlight") as string}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
            {t("hero.subtitle") as string}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button size="lg" asChild>
              <Link href={getHref("/download/")}>
                {t("hero.ctaPrimary") as string}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={getHref("/features/")}>{t("hero.ctaSecondary") as string}</Link>
            </Button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
              <Brain className="h-4 w-4 text-primary" />
              <span>AI Auto-Tagging</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
              <Search className="h-4 w-4 text-primary" />
              <span>Semantic Search</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
              <Zap className="h-4 w-4 text-primary" />
              <span>100% Offline</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
              <Shield className="h-4 w-4 text-primary" />
              <span>Privacy First</span>
            </div>
          </div>
        </div>

        {/* Hero Image / App Preview */}
        <div className="mt-16 md:mt-20">
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-xl border bg-card p-2 shadow-2xl">
              <div className="rounded-lg bg-muted aspect-[16/10] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Brain className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm">App Preview Image</p>
                  <p className="text-xs mt-1">Replace with actual screenshot</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

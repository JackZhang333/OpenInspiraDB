import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/sections/hero";
import { FeaturesSection } from "@/components/sections/features";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { UseCasesSection } from "@/components/sections/use-cases";
import { CTASection } from "@/components/sections/cta";
import { SchemaOrg } from "@/components/seo/schema-org";
import { I18nProvider } from "@/components/i18n-provider";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: localeParam } = await params;
  const locale = (locales.includes(localeParam as Locale) ? localeParam : defaultLocale) as Locale;

  return (
    <I18nProvider locale={locale}>
      <SchemaOrg locale={locale} />
      <Navigation />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <UseCasesSection />
        <CTASection />
      </main>
      <Footer />
    </I18nProvider>
  );
}

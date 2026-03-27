import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Globe, Code2 } from "lucide-react";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface ContactPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale: localeParam } = await params;
  const locale = (locales.includes(localeParam as Locale) ? localeParam : defaultLocale) as Locale;
  const isZh = locale === "zh";

  return (
    <I18nProvider locale={locale}>
      <Navigation />
      <main className="flex-1">
        <section className="py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container text-center max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {isZh ? "联系我们" : "Contact Us"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? "有任何问题或建议？我们很乐意听到你的声音"
                : "Have questions or suggestions? We'd love to hear from you"}
            </p>
          </div>
        </section>

        <section className="py-24">
          <div className="container max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Mail className="h-8 w-8 mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold mb-2">Email</h3>
                  <a href="mailto:contact@inspiradb.com" className="text-sm text-muted-foreground hover:text-primary">
                    contact@inspiradb.com
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Globe className="h-8 w-8 mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold mb-2">Twitter</h3>
                  <a href="https://twitter.com/inspiradb" className="text-sm text-muted-foreground hover:text-primary">
                    @inspiradb
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Code2 className="h-8 w-8 mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold mb-2">GitHub</h3>
                  <a href="https://github.com/inspiradb" className="text-sm text-muted-foreground hover:text-primary">
                    github.com/inspiradb
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

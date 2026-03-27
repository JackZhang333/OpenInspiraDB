import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Apple, Download, Cpu, CheckCircle } from "lucide-react";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const requirements = [
  { en: "macOS 13.0 (Ventura) or later", zh: "macOS 13.0 (Ventura) 或更高版本" },
  { en: "4GB RAM minimum (8GB recommended)", zh: "最低4GB内存 (推荐8GB)" },
  { en: "500MB disk space for app", zh: "应用占用500MB磁盘空间" },
  { en: "Additional space for image library", zh: "图片库需额外磁盘空间" },
];

interface DownloadPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DownloadPage({ params }: DownloadPageProps) {
  const { locale: localeParam } = await params;
  const locale = (locales.includes(localeParam as Locale) ? localeParam : defaultLocale) as Locale;
  const isZh = locale === "zh";

  return (
    <I18nProvider locale={locale}>
      <Navigation />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container text-center max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {isZh ? "下载 InspiraDB" : "Download InspiraDB"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? " macOS 13.0 或更高版本"
                : " macOS 13.0 or later"}
            </p>
          </div>
        </section>

        {/* Download Cards */}
        <section className="py-24">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Intel Mac */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Cpu className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>
                    {isZh ? "Mac (Intel)" : "Mac (Intel)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground mb-6">
                    {isZh ? "适用于Intel处理器的Mac" : "For Macs with Intel processors"}
                  </p>
                  <Button size="lg" className="w-full" asChild>
                    <a
                      href="https://apps.apple.com/us/app/inspiradb/id6760753067?mt=12"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isZh ? "下载 Intel 版本" : "Download for Intel"}
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Apple Silicon */}
              <Card className="hover:shadow-lg transition-shadow border-primary">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Apple className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>
                    {isZh ? "Mac (Apple Silicon)" : "Mac (Apple Silicon)"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground mb-6">
                    {isZh ? "适用于 M1/M2/M3 Mac" : "For M1/M2/M3 Macs"}
                  </p>
                  <Button size="lg" className="w-full" asChild>
                    <a
                      href="https://apps.apple.com/us/app/inspiradb/id6760753067?mt=12"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isZh ? "下载 Apple Silicon 版本" : "Download for Apple Silicon"}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* System Requirements */}
            <div className="mt-16 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-center mb-8">
                {isZh ? "系统要求" : "System Requirements"}
              </h2>
              <Card>
                <CardContent className="pt-6">
                  <ul className="space-y-4">
                    {requirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                        <span>{isZh ? req.zh : req.en}</span>
                      </li>
                    ))}
                  </ul>
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

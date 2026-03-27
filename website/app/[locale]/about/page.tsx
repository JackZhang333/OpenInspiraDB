import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
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
              {isZh ? "关于 InspiraDB" : "About InspiraDB"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? "让每一张图片，都能被找到"
                : "Let every image be found"}
            </p>
          </div>
        </section>

        <section className="py-24">
          <div className="container max-w-3xl">
            <p className="text-lg text-muted-foreground mb-6">
              {isZh
                ? "InspiraDB 诞生于一个简单的信念：技术应该让人更轻松。我们相信，设计师不应该花费数小时在文件夹中寻找参考图，摄影师不应该因为找不到历史作品而失去客户，创意工作者不应该被混乱的数字资产所困扰。"
                : "InspiraDB was born from a simple belief: technology should make life easier. We believe designers shouldn't spend hours searching through folders for reference images, photographers shouldn't lose clients because they can't find historical work, and creators shouldn't be troubled by disorganized digital assets."}
            </p>
            <p className="text-lg text-muted-foreground mb-6">
              {isZh
                ? "我们的团队由产品人、工程师和设计师组成，我们都在创意行业工作多年，深刻理解素材管理的痛点。InspiraDB 是我们为自己打造的工具，现在我们也想分享给你。"
                : "Our team consists of product people, engineers, and designers who have worked in the creative industry for years, deeply understanding the pain points of asset management. InspiraDB is the tool we built for ourselves, and now we want to share it with you."}
            </p>
            <p className="text-lg text-muted-foreground">
              {isZh
                ? "我们坚信隐私是基本权利。这就是为什么 InspiraDB 采用本地优先架构，你的图片永远属于你，存储在你的设备上，由你完全控制。"
                : "We believe privacy is a fundamental right. That's why InspiraDB adopts a local-first architecture—your images always belong to you, stored on your device, completely under your control."}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

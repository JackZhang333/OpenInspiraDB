import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Palette, Camera, Video, Quote, CheckCircle } from "lucide-react";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const useCases = [
  {
    icon: Palette,
    image: "/scene1.jpg",
    title: "UI/UX Designers",
    titleZh: "UI/UX设计师",
    subtitle: "From folder chaos to organized bliss",
    subtitleZh: "从文件夹混乱到有序幸福",
    quote: "I used to spend 2 hours looking for reference images. Now I find them in 30 seconds.",
    quoteZh: "我以前花2小时找参考图，现在30秒就能找到。",
    author: "Sarah Chen, Product Designer",
    authorZh: "陈莎拉，产品设计师",
    benefits: [
      { en: "Find 'minimalist login page from last year' instantly", zh: "秒速找到'去年的极简登录页'" },
      { en: "Build mood boards without folder hell", zh: "无需翻遍文件夹就能建立情绪板" },
      { en: "Search by design style, not filename", zh: "按设计风格搜索，而非文件名" },
      { en: "Reference past project visuals in seconds", zh: "秒速引用过往项目视觉" },
    ],
  },
  {
    icon: Camera,
    image: "/scene2.jpg",
    title: "Photographers",
    titleZh: "摄影师",
    subtitle: "500,000 photos, instantly searchable",
    subtitleZh: "50万张照片，即时搜索",
    quote: "When clients ask 'do you have similar to this?', I find matches in 10 seconds instead of 30 minutes.",
    quoteZh: "当客户问'有类似这张的吗'，我10秒找到匹配，而不是30分钟。",
    author: "Mike Zhang, Wedding Photographer",
    authorZh: "张麦克，婚礼摄影师",
    benefits: [
      { en: "Organize by lighting, mood, and composition", zh: "按光线、氛围、构图自动整理" },
      { en: "Semantic similarity search from reference images", zh: "从参考图进行语义相似搜索" },
      { en: "Client presentation prep in minutes, not hours", zh: "客户展示准备从几小时缩短到几分钟" },
      { en: "New employee training reduced by 70%", zh: "新员工培训时间减少70%" },
    ],
  },
  {
    icon: Video,
    image: "/scene3.jpg",
    title: "Content Creators",
    titleZh: "内容创作者",
    subtitle: "Never lose a thumbnail idea again",
    subtitleZh: "再也不丢缩略图创意",
    quote: "My thumbnail inspiration folder was a black hole. Now I search 'bold red text overlay' and get exactly that.",
    quoteZh: "我的缩略图灵感文件夹曾是黑洞。现在搜索'粗体红色文字叠加'，精准找到想要的。",
    author: "Lisa Wang, YouTuber",
    authorZh: "王丽莎，YouTuber",
    benefits: [
      { en: "Archive and search thumbnail concepts", zh: "归档和搜索缩略图创意" },
      { en: "Find 'vintage aesthetic' or 'modern minimal' instantly", zh: "秒速找到'复古美学'或'现代极简'" },
      { en: "Build consistent visual branding", zh: "建立一致的视觉品牌" },
      { en: "Repurpose content across platforms", zh: "跨平台复用内容" },
    ],
  },
];

interface UseCasesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function UseCasesPage({ params }: UseCasesPageProps) {
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
              {isZh ? "为创意专业人士打造" : "Built for Creative Professionals"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? "看看设计师、摄影师和内容创作者如何使用InspiraDB改变工作流程"
                : "See how designers, photographers, and creators use InspiraDB to transform their workflow"}
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24">
          <div className="container space-y-24">
            {useCases.map((useCase, index) => (
              <div
                key={useCase.title}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Content */}
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <useCase.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">
                    {isZh ? useCase.titleZh : useCase.title}
                  </h2>
                  <p className="text-xl text-muted-foreground mb-8">
                    {isZh ? useCase.subtitleZh : useCase.subtitle}
                  </p>

                  {/* Quote */}
                  <Card className="mb-8 bg-muted/50">
                    <CardContent className="pt-6">
                      <Quote className="h-6 w-6 text-primary/50 mb-2" />
                      <p className="text-lg italic mb-4">
                        {isZh ? useCase.quoteZh : useCase.quote}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        — {isZh ? useCase.authorZh : useCase.author}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Benefits */}
                  <ul className="space-y-3">
                    {useCase.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>{isZh ? benefit.zh : benefit.en}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual */}
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <div className="aspect-square rounded-2xl overflow-hidden">
                    <Image
                      src={useCase.image}
                      alt={isZh ? useCase.titleZh : useCase.title}
                      width={600}
                      height={600}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-muted/30">
          <div className="container text-center max-w-2xl">
            <h2 className="text-3xl font-bold mb-4">
              {isZh ? "准备好改变你的工作流程了吗？" : "Ready to transform your workflow?"}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isZh
                ? "加入数千名已经解放生产力的创意专业人士"
                : "Join thousands of creative professionals who've already liberated their productivity"}
            </p>
            <Button size="lg" asChild>
              <Link href="/download">
                {isZh ? "免费下载试用" : "Download Free Trial"}
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

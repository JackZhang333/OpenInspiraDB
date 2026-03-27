import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Check } from "lucide-react";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const plans = [
  {
    key: "free",
    price: { en: "$0", zh: "¥0" },
    period: { en: "forever", zh: "永久" },
    features: [
      { en: "Up to 1,000 images", zh: "最多1,000张图片" },
      { en: "Basic AI tagging", zh: "基础AI打标" },
      { en: "Local storage only", zh: "纯本地存储" },
      { en: "Community support", zh: "社区支持" },
    ],
    cta: { en: "Get Started", zh: "开始使用" },
    popular: false,
  },
  {
    key: "pro",
    price: { en: "$49", zh: "¥349" },
    period: { en: "one-time", zh: "一次性" },
    badge: { en: "Most Popular", zh: "最受欢迎" },
    features: [
      { en: "Unlimited images", zh: "无限图片数量" },
      { en: "Advanced AI tagging", zh: "高级AI打标" },
      { en: "Semantic search", zh: "语义搜索" },
      { en: "Priority support", zh: "优先支持" },
      { en: "Lifetime updates", zh: "终身更新" },
    ],
    cta: { en: "Buy Pro", zh: "购买专业版" },
    popular: true,
  },
  {
    key: "team",
    price: { en: "$199", zh: "¥1,399" },
    period: { en: "one-time", zh: "一次性" },
    features: [
      { en: "Everything in Pro", zh: "专业版全部功能" },
      { en: "5 team members", zh: "5名团队成员" },
      { en: "Shared libraries", zh: "共享素材库" },
      { en: "Admin dashboard", zh: "管理后台" },
      { en: "Custom training", zh: "定制训练" },
    ],
    cta: { en: "Contact Sales", zh: "联系销售" },
    popular: false,
  },
];

const faqs = [
  {
    q: { en: "Is it really a one-time payment?", zh: "真的是一次性付款吗？" },
    a: {
      en: "Yes! Pay once, own forever. No subscriptions, no recurring fees. You'll receive all future updates to your version for free.",
      zh: "是的！一次付款，永久拥有。没有订阅，没有重复费用。你的版本将获得所有未来更新。",
    },
  },
  {
    q: { en: "What happens to my images?", zh: "我的图片会怎样？" },
    a: {
      en: "Your images stay on your Mac at all times. We create a local library copy for management, but your originals remain untouched in their original locations.",
      zh: "你的图片始终保留在你的Mac上。我们会创建本地库副本用于管理，但原文件在原位置保持不动。",
    },
  },
  {
    q: { en: "Can I use it without internet?", zh: "没有网络能用吗？" },
    a: {
      en: "Absolutely! After initial AI analysis (which requires internet), everything works offline. Search, browse, organize — no connection needed.",
      zh: "当然！初始AI分析后（需要网络），一切功能离线可用。搜索、浏览、整理——无需连接。",
    },
  },
  {
    q: { en: "Is my data private?", zh: "我的数据私密吗？" },
    a: {
      en: "100% private. Images are analyzed by our cloud AI, but never stored there. All data lives encrypted on your local machine. We couldn't access your images even if we wanted to.",
      zh: "100%私密。图片由云端AI分析，但永不存储。所有数据加密存储在本地机器。即使我们想访问也无法做到。",
    },
  },
  {
    q: { en: "What's the refund policy?", zh: "退款政策是什么？" },
    a: {
      en: "14-day money-back guarantee. If InspiraDB doesn't transform your workflow, email us for a full refund. No questions asked.",
      zh: "14天退款保证。如果InspiraDB没有改变你的工作流程，发邮件给我们全额退款。不问原因。",
    },
  },
];

interface PricingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PricingPage({ params }: PricingPageProps) {
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
              {isZh ? "简单透明的定价" : "Simple, Transparent Pricing"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? "一次性付款，永久拥有。没有订阅陷阱。"
                : "Pay once, own forever. No subscription traps."}
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-24">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.key}
                  className={`relative flex flex-col ${
                    plan.popular ? "border-primary shadow-lg scale-105" : ""
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      {isZh ? plan.badge?.zh : plan.badge?.en}
                    </Badge>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl capitalize">{plan.key}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">
                        {isZh ? plan.price.zh : plan.price.en}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        / {isZh ? plan.period.zh : plan.period.en}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-4 mb-8 flex-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <Check className="h-5 w-5 text-primary shrink-0" />
                          <span>{isZh ? feature.zh : feature.en}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={plan.popular ? "default" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link href="/download">
                        {isZh ? plan.cta.zh : plan.cta.en}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 bg-muted/30">
          <div className="container max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-12">
              {isZh ? "常见问题" : "Frequently Asked Questions"}
            </h2>
            <div className="space-y-6">
              {faqs.map((faq, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {isZh ? faq.q.zh : faq.q.en}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {isZh ? faq.a.zh : faq.a.en}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

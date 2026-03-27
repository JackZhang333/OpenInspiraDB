import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const blogPosts = [
  {
    slug: "ai-image-tagging-cloud-local-hybrid",
    title: "AI Image Tagging: How Cloud-Local Hybrid Architecture Works",
    titleZh: "AI图片打标：云端本地混合架构如何工作",
    excerpt: "Discover how the BigBrain+SmallBrain architecture delivers both intelligent auto-tagging and lightning-fast local search.",
    excerptZh: "了解大小脑架构如何同时提供智能自动打标和极速本地搜索。",
    category: "Technology",
    categoryZh: "技术",
    date: "2025-03-27",
    readTime: "5 min read",
    readTimeZh: "5分钟阅读",
  },
  {
    slug: "semantic-search-vs-keyword-search",
    title: "Semantic Search vs Keyword Search: A Designer's Guide",
    titleZh: "语义搜索 vs 关键词搜索：设计师指南",
    excerpt: "Why searching by intention rather than keywords transforms how you find visual inspiration.",
    excerptZh: "为什么按意图而非关键词搜索会改变你寻找视觉灵感的方式。",
    category: "Tutorial",
    categoryZh: "教程",
    date: "2025-03-25",
    readTime: "4 min read",
    readTimeZh: "4分钟阅读",
  },
  {
    slug: "privacy-first-image-management",
    title: "Why Your Photos Never Leave Your Computer: Privacy-First AI",
    titleZh: "为什么你的照片永不离开电脑：隐私优先的AI",
    excerpt: "How local-first architecture protects your creative assets while delivering powerful AI capabilities.",
    excerptZh: "本地优先架构如何在提供强大AI能力的同时保护你的创意资产。",
    category: "Privacy",
    categoryZh: "隐私",
    date: "2025-03-20",
    readTime: "6 min read",
    readTimeZh: "6分钟阅读",
  },
  {
    slug: "offline-ai-image-analysis",
    title: "Offline AI Image Analysis: How Local Models Power Fast Search",
    titleZh: "离线AI图片分析：本地模型如何实现快速搜索",
    excerpt: "The technical magic behind millisecond semantic search that works without internet.",
    excerptZh: "无需网络即可工作的毫秒级语义搜索背后的技术魔法。",
    category: "Technology",
    categoryZh: "技术",
    date: "2025-03-15",
    readTime: "7 min read",
    readTimeZh: "7分钟阅读",
  },
  {
    slug: "brain-inspired-image-organization",
    title: "The Brain-Inspired Approach to Image Organization",
    titleZh: "受大脑启发的图片组织方法",
    excerpt: "How cognitive science inspired the hybrid AI architecture powering InspiraDB.",
    excerptZh: "认知科学如何启发为InspiraDB提供动力的混合AI架构。",
    category: "Product",
    categoryZh: "产品",
    date: "2025-03-10",
    readTime: "5 min read",
    readTimeZh: "5分钟阅读",
  },
  {
    slug: "10-best-ai-photo-organizers-2025",
    title: "10 Best AI Photo Organizers for Mac (2025 Comparison)",
    titleZh: "10款最佳Mac AI照片管理工具（2025对比）",
    excerpt: "An honest comparison of the top image management tools for creative professionals.",
    excerptZh: "为创意专业人士提供的顶级图片管理工具诚实对比。",
    category: "Review",
    categoryZh: "评测",
    date: "2025-03-05",
    readTime: "10 min read",
    readTimeZh: "10分钟阅读",
  },
];

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BlogPage({ params }: BlogPageProps) {
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
              {isZh ? "博客" : "Blog"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? "关于AI图片管理、语义搜索和创意工作流程的见解"
                : "Insights on AI image management, semantic search, and creative workflows"}
            </p>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-24">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}/`}>
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <Badge variant="secondary" className="w-fit mb-3">
                        {isZh ? post.categoryZh : post.category}
                      </Badge>
                      <CardTitle className="text-lg">
                        {isZh ? post.titleZh : post.title}
                      </CardTitle>
                      <CardDescription>
                        {post.date} · {isZh ? post.readTimeZh : post.readTime}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {isZh ? post.excerptZh : post.excerpt}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

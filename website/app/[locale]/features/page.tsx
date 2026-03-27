import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Search, WifiOff, Shield, CloudLightning, Tag, Layers, Clock } from "lucide-react";
import { locales, type Locale, defaultLocale } from "@/i18n/config";

export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const features = [
  {
    icon: Brain,
    title: "AI Auto-Tagging",
    titleZh: "AI自动打标",
    description: "Our Cloud BigBrain analyzes every image you import, automatically generating precise Chinese tags organized in a three-tier system: Industry Use (e-commerce, poster, UI, logo), Composition (centered, full-bleed, split-screen, whitespace), and Mood (tech, artistic, festive, premium).",
    descriptionZh: "云端大脑分析每张导入的图片，自动生成精准中文标签，按三级体系分类：行业用途（电商、海报、UI、LOGO）、构图形式（居中、满版、分屏、留白）、情绪氛围（科技感、文艺、喜庆、高级）。",
  },
  {
    icon: Search,
    title: "Semantic Search",
    titleZh: "语义搜索",
    description: "Search by intention, not keywords. When you type 'blue tech product hero shot', InspiraDB understands 'blue' as cool tones, 'tech' as clean and futuristic aesthetics, and 'hero shot' as centered product composition. Results are ranked by relevance, not filename matches.",
    descriptionZh: "按意图搜索，而非关键词。输入'蓝色科技感电子产品主图'，InspiraDB理解'蓝色'为冷色调、'科技'为简洁未来感美学、'主图'为居中产品构图。结果按相关性排序，而非文件名匹配。",
  },
  {
    icon: WifiOff,
    title: "100% Offline",
    titleZh: "100%离线",
    description: "Once images are analyzed, everything works without internet. Lightning-fast millisecond response times. Perfect for working on planes, in remote locations, or anywhere with unreliable connectivity. Your creativity shouldn't depend on WiFi.",
    descriptionZh: "图片分析完成后，无需网络即可使用一切功能。毫秒级闪电响应。完美适用于飞机上、偏远地区或网络不稳定的环境。你的创作不应依赖WiFi。",
  },
  {
    icon: Shield,
    title: "Privacy First",
    titleZh: "隐私优先",
    description: "Your images never leave your Mac. All data is stored locally with encrypted indexing. Zero data transmission to external servers after initial AI analysis. Complete protection for commercial confidentiality and sensitive projects.",
    descriptionZh: "你的图片永不离开Mac。所有数据本地存储并加密索引。初始AI分析后零数据传输到外部服务器。完全保护商业机密和敏感项目。",
  },
  {
    icon: CloudLightning,
    title: "BigBrain + SmallBrain",
    titleZh: "大小脑协同",
    description: "Cloud BigBrain continuously learns from user behavior and evolves the tag system. Local SmallBrain handles vector calculations for millisecond semantic search. This hybrid architecture delivers both intelligent evolution and instant response.",
    descriptionZh: "云端大脑持续学习用户行为并进化标签体系。本地小脑处理向量计算实现毫秒级语义搜索。这种混合架构兼顾智能进化与即时响应。",
  },
  {
    icon: Tag,
    title: "Smart Deduplication",
    titleZh: "智能去重",
    description: "Advanced MD5 hash detection identifies exact duplicates during import. Save storage space and avoid confusion from multiple copies of the same image across different folders.",
    descriptionZh: "先进的MD5哈希检测在导入时识别完全重复的文件。节省存储空间，避免同一图片在不同文件夹的多份拷贝造成的混乱。",
  },
  {
    icon: Layers,
    title: "Batch Import",
    titleZh: "批量导入",
    description: "Drag and drop entire folders containing thousands of images. InspiraDB automatically scans, imports, and queues them for AI analysis. Support for JPG, PNG, WebP, and HEIC formats up to 50MB per file.",
    descriptionZh: "拖拽包含数千张图片的整个文件夹。InspiraDB自动扫描、导入并排队进行AI分析。支持JPG、PNG、WebP、HEIC格式，单文件最大50MB。",
  },
  {
    icon: Clock,
    title: "Resume & Retry",
    titleZh: "断点续传",
    description: "Analysis interrupted? No problem. InspiraDB automatically resumes incomplete tasks on app restart. Failed analyses can be manually retried with full error visibility.",
    descriptionZh: "分析中断？没问题。InspiraDB在应用重启时自动恢复未完成任务。失败分析可手动重试，完整错误信息可见。",
  },
];

interface FeaturesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FeaturesPage({ params }: FeaturesPageProps) {
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
              {isZh ? "强大功能，为设计师打造" : "Powerful Features for Designers"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {isZh
                ? "五大核心能力，配合智能工具，彻底革新你的视觉素材管理"
                : "Five core capabilities plus intelligent tools that transform how you manage visual assets"}
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle>{isZh ? feature.titleZh : feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {isZh ? feature.descriptionZh : feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

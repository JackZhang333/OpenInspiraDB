import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { I18nProvider } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { locales, type Locale, defaultLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

export function generateStaticParams() {
  const slugs = [
    "ai-image-tagging-cloud-local-hybrid",
    "semantic-search-vs-keyword-search",
    "privacy-first-image-management",
    "offline-ai-image-analysis",
    "brain-inspired-image-organization",
    "10-best-ai-photo-organizers-2025",
  ];
  return locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug }))
  );
}

const blogPostsContent: Record<string, BlogPost> = {
  "ai-image-tagging-cloud-local-hybrid": {
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
    content: [
      {
        type: "paragraph",
        text: "In the age of digital content explosion, managing thousands of images has become a significant challenge for creative professionals. Traditional folder-based organization falls short when you need to find that specific image with 'a red bicycle against a sunset background.' This is where AI-powered image tagging comes into play, and the cloud-local hybrid architecture represents the cutting edge of this technology."
      },
      {
        type: "heading",
        text: "The Challenge: Intelligence vs. Speed"
      },
      {
        type: "paragraph",
        text: "For years, image management faced a fundamental trade-off. Cloud-based AI services like Google Vision or AWS Rekognition offer powerful, accurate image analysis, but they require uploading your entire photo library to remote servers. This raises privacy concerns and creates latency issues. On the other hand, purely local solutions protect privacy but often lack the computational power to deliver sophisticated tagging."
      },
      {
        type: "paragraph",
        text: "The hybrid approach solves this dilemma by intelligently combining both worlds. Imagine having a 'Big Brain' in the cloud that learns from billions of images, and a 'Small Brain' on your local machine that handles day-to-day operations. This is exactly what modern hybrid architectures achieve."
      },
      {
        type: "heading",
        text: "How the BigBrain+SmallBrain Architecture Works"
      },
      {
        type: "paragraph",
        text: "The BigBrain component leverages powerful cloud AI models to generate rich, semantic tags during the initial import phase. When you add new images to your library, they're temporarily processed by advanced multimodal models that can understand complex scenes, objects, emotions, and even artistic styles. These tags are then stored locally alongside your images."
      },
      {
        type: "paragraph",
        text: "The SmallBrain takes over for daily operations. It's a lightweight, locally-running embedding model that converts your search queries into vector representations. When you search for 'cozy winter cabin,' the SmallBrain converts this query into a mathematical representation and compares it against pre-computed embeddings of your tagged images—all happening locally on your machine in milliseconds."
      },
      {
        type: "heading",
        text: "The Benefits of This Approach"
      },
      {
        type: "list",
        items: [
          "Privacy First: Your actual image data never leaves your computer after the initial tagging",
          "Lightning Fast: Searches happen locally with sub-100ms response times",
          "Intelligent Tagging: Leverages state-of-the-art cloud AI for accurate, comprehensive tags",
          "Offline Capability: Once tagged, your entire library is searchable without internet",
          "Cost Effective: No ongoing cloud compute costs for searching your library"
        ]
      },
      {
        type: "heading",
        text: "Real-World Performance"
      },
      {
        type: "paragraph",
        text: "In practical use, this architecture delivers the best of both worlds. A designer with 50,000 images can search for 'minimalist logo designs with blue gradients' and get relevant results in under 100ms, even without an internet connection. The initial tagging of new images might take a few seconds per batch, but this happens in the background and only once per image."
      },
      {
        type: "paragraph",
        text: "The future of image management lies in this intelligent distribution of work. Cloud AI provides the heavy lifting for understanding content, while local processing ensures privacy, speed, and availability. For creative professionals who value both efficiency and privacy, the hybrid approach isn't just a compromise—it's the optimal solution."
      }
    ],
    contentZh: [
      {
        type: "paragraph",
        text: "在数字内容爆炸的时代，管理数千张图片已成为创意专业人士面临的重大挑战。当你需要找到那张'夕阳背景下红色自行车'的特定图片时，传统的基于文件夹的组织方式显得力不从心。这就是AI驱动的图片打标发挥作用的地方，而云端本地混合架构代表了这项技术的最前沿。"
      },
      {
        type: "heading",
        text: "挑战：智能与速度的权衡"
      },
      {
        type: "paragraph",
        text: "多年来，图片管理面临一个根本性的权衡。像Google Vision或AWS Rekognition这样的云端AI服务提供强大、准确的图片分析，但它们需要你将整个照片库上传到远程服务器。这引发了隐私担忧并产生延迟问题。另一方面，纯本地解决方案保护隐私，但往往缺乏提供复杂打标所需的计算能力。"
      },
      {
        type: "paragraph",
        text: "混合方法通过智能结合两个世界解决了这个困境。想象一下，云端有一个从数十亿张图片中学习的'大脑'，本地机器上有一个处理日常操作的'小脑'。这正是现代混合架构所实现的。"
      },
      {
        type: "heading",
        text: "大小脑架构如何工作"
      },
      {
        type: "paragraph",
        text: "大脑组件利用强大的云端AI模型在初始导入阶段生成丰富的语义标签。当你将新图片添加到库中时，它们会被高级多模态模型临时处理，这些模型可以理解复杂的场景、物体、情感甚至艺术风格。然后这些标签被本地存储在你的图片旁边。"
      },
      {
        type: "paragraph",
        text: "小脑接管日常操作。它是一个轻量级的本地运行嵌入模型，将你的搜索查询转换为向量表示。当你搜索'舒适的冬日小屋'时，小脑将这个查询转换为数学表示，并与你的标签图片的预计算嵌入进行比较——所有这些都在你的机器上本地进行，只需毫秒。"
      },
      {
        type: "heading",
        text: "这种方法的好处"
      },
      {
        type: "list",
        items: [
          "隐私优先：初始打标后，你的实际图片数据永远不会离开你的电脑",
          "极速搜索：搜索在本地进行，响应时间低于100毫秒",
          "智能打标：利用最先进的云端AI进行准确、全面的标签",
          "离线能力：一旦打标完成，你的整个库无需网络即可搜索",
          "成本效益：搜索库时无需持续的云端计算成本"
        ]
      },
      {
        type: "heading",
        text: "实际性能表现"
      },
      {
        type: "paragraph",
        text: "在实际使用中，这种架构提供了两全其美的优势。一位拥有50,000张图片的设计师可以搜索'带有蓝色渐变的极简logo设计'，并在100毫秒内获得相关结果，即使没有网络连接。新图片的初始打标可能需要每批几秒钟，但这在后台进行，且每张图片只需一次。"
      },
      {
        type: "paragraph",
        text: "图片管理的未来在于这种智能的工作分配。云端AI提供理解内容的重任，而本地处理确保隐私、速度和可用性。对于既重视效率又重视隐私的创意专业人士来说，混合方法不仅仅是一种妥协——它是最佳解决方案。"
      }
    ]
  },
  "semantic-search-vs-keyword-search": {
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
    content: [
      {
        type: "paragraph",
        text: "We've all been there. You have a vivid image in your mind—a moody portrait with dramatic lighting, shot from a low angle—but when you search your image library for 'portrait,' you're overwhelmed with thousands of results. Traditional keyword search forces you to translate your visual intent into text, often losing nuance along the way. Semantic search changes everything."
      },
      {
        type: "heading",
        text: "The Limitations of Keyword Search"
      },
      {
        type: "paragraph",
        text: "Keyword search is literal. If you tag an image as 'beach,' you can only find it by searching for 'beach' or predefined synonyms. But what if you're looking for 'tropical vacation vibes' or 'serene shoreline at golden hour'? The gap between human intention and literal keywords creates friction in creative workflows."
      },
      {
        type: "paragraph",
        text: "Designers often develop complex tagging taxonomies to bridge this gap—creating hierarchies like Location > Beach > Tropical > Sunset. But maintaining these systems is tedious, and they still can't capture the full richness of visual meaning."
      },
      {
        type: "heading",
        text: "How Semantic Search Works"
      },
      {
        type: "paragraph",
        text: "Semantic search uses AI to understand the meaning behind your query. Instead of matching text strings, it converts both your search query and your images into mathematical representations called embeddings. These embeddings capture the conceptual essence of content—understanding that 'cozy fireplace' and 'warm winter cabin' are conceptually related, even though they share no keywords."
      },
      {
        type: "paragraph",
        text: "The technology behind this is remarkable. Multimodal AI models can process both text and images, creating a shared 'understanding space' where similar concepts cluster together. When you search for 'elegant minimalism,' the system understands this encompasses clean lines, negative space, muted colors, and refined composition—not just images explicitly tagged as 'minimalist.'"
      },
      {
        type: "heading",
        text: "Practical Applications for Designers"
      },
      {
        type: "paragraph",
        text: "Imagine you're working on a brand identity project and need inspiration for 'modern but approachable tech aesthetics.' With keyword search, you'd be stuck trying combinations like 'tech,' 'modern,' 'friendly,' and hoping for the best. With semantic search, you describe exactly what you're looking for, and the AI surfaces images that match the feeling—even if they were never explicitly tagged that way."
      },
      {
        type: "list",
        items: [
          "Mood-based discovery: Find images that evoke specific emotions or atmospheres",
          "Concept exploration: Search by abstract ideas like 'growth,' 'trust,' or 'innovation'",
          "Visual similarity: Start with one image and find others with similar composition or style",
          "Cross-domain inspiration: Search for 'architectural elegance' and find relevant fashion photography"
        ]
      },
      {
        type: "heading",
        text: "Making the Transition"
      },
      {
        type: "paragraph",
        text: "Adopting semantic search doesn't mean abandoning organization entirely. Many designers find a hybrid approach works best—using folders for broad project categories while relying on semantic search for discovery within those categories. The key is trusting that AI can understand your intent, freeing you from the burden of meticulous keyword tagging."
      },
      {
        type: "paragraph",
        text: "The result is a more fluid, intuitive creative process. Instead of wrestling with search terms, you focus on articulating your vision—and the technology meets you there. For designers, this isn't just a convenience; it's a fundamental shift in how we interact with our visual libraries."
      }
    ],
    contentZh: [
      {
        type: "paragraph",
        text: "我们都经历过这种情况。你脑海中有一个生动的画面——一个低角度拍摄、戏剧性光线的情绪化肖像——但当你在图片库中搜索'肖像'时，却被成千上万的结果淹没。传统的关键词搜索迫使你将自己的视觉意图转化为文字，往往在这个过程中失去细微差别。语义搜索改变了一切。"
      },
      {
        type: "heading",
        text: "关键词搜索的局限性"
      },
      {
        type: "paragraph",
        text: "关键词搜索是字面意义的。如果你将一张图片标记为'海滩'，你只能通过搜索'海滩'或预定义的同义词来找到它。但如果你要找的是'热带度假氛围'或'黄金时刻的宁静海岸'呢？人类意图和字面关键词之间的差距在创意工作流程中产生了摩擦。"
      },
      {
        type: "paragraph",
        text: "设计师经常开发复杂的打标分类法来弥合这一差距——创建像地点 > 海滩 > 热带 > 日落这样的层级。但维护这些系统很繁琐，而且它们仍然无法捕捉视觉意义的全部丰富性。"
      },
      {
        type: "heading",
        text: "语义搜索如何工作"
      },
      {
        type: "paragraph",
        text: "语义搜索使用AI来理解查询背后的含义。它不是匹配文本字符串，而是将你的搜索查询和图片转换为称为嵌入的数学表示。这些嵌入捕捉内容的概念本质——理解'舒适的壁炉'和'温暖的冬日小屋'在概念上是相关的，即使它们没有共享关键词。"
      },
      {
        type: "paragraph",
        text: "这背后的技术令人瞩目。多模态AI模型可以同时处理文本和图片，创建一个共享的'理解空间'，在那里相似的概念聚集在一起。当你搜索'优雅的极简主义'时，系统理解这包括干净的线条、负空间、柔和的色调和精致的构图——而不仅仅是明确标记为'极简主义'的图片。"
      },
      {
        type: "heading",
        text: "对设计师的实际应用"
      },
      {
        type: "paragraph",
        text: "想象一下，你正在进行一个品牌识别项目，需要寻找'现代但平易近人的科技美学'的灵感。用关键词搜索，你会被困在尝试'科技'、'现代'、'友好'等组合，希望获得最好的结果。有了语义搜索，你准确描述你要找的内容，AI就会呈现符合这种感觉的图片——即使它们从未被明确那样标记。"
      },
      {
        type: "list",
        items: [
          "基于情绪的发现：找到唤起特定情绪或氛围的图片",
          "概念探索：通过抽象概念如'成长'、'信任'或'创新'来搜索",
          "视觉相似性：从一张图片开始，找到其他构图或风格相似的图片",
          "跨领域灵感：搜索'建筑优雅'并找到相关的时尚摄影"
        ]
      },
      {
        type: "heading",
        text: "进行过渡"
      },
      {
        type: "paragraph",
        text: "采用语义搜索并不意味着完全放弃组织。许多设计师发现混合方法效果最好——使用文件夹进行广泛的项目分类，同时依靠语义搜索在这些类别中发现内容。关键是相信AI可以理解你的意图，让你从细致的关键词打标负担中解放出来。"
      },
      {
        type: "paragraph",
        text: "结果是更流畅、更直观的创作过程。你不是与搜索术语搏斗，而是专注于阐述你的愿景——而技术在那里与你相遇。对于设计师来说，这不仅仅是一种便利；它是我们与视觉库互动方式的根本转变。"
      }
    ]
  },
  "privacy-first-image-management": {
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
    content: [
      {
        type: "paragraph",
        text: "In an era where data breaches make headlines weekly and cloud services monetize user content, privacy has become a critical concern for creative professionals. Your image library isn't just a collection of files—it's your intellectual property, your creative process, often your livelihood. The shift toward privacy-first, local AI image management represents a fundamental rethinking of how technology should serve creators."
      },
      {
        type: "heading",
        text: "The Problem with Cloud-First AI"
      },
      {
        type: "paragraph",
        text: "Most AI-powered image tools require uploading your entire library to remote servers. While convenient, this creates several risks:"
      },
      {
        type: "list",
        items: [
          "Data breaches: Even major tech companies experience security incidents",
          "Service dependency: Your workflow breaks if the service shuts down or changes pricing",
          "Content analysis: Uploaded images may be used to train AI models or serve ads",
          "Jurisdiction issues: Your data may be stored in countries with different privacy laws",
          "Sync conflicts: Managing large media libraries across devices creates version control nightmares"
        ]
      },
      {
        type: "paragraph",
        text: "For professionals working with client work, unreleased products, or sensitive materials, these aren't theoretical concerns—they're deal-breakers."
      },
      {
        type: "heading",
        text: "The Local-First Alternative"
      },
      {
        type: "paragraph",
        text: "Privacy-first image management flips the script. Instead of your data going to the AI, the AI comes to your data. Modern local AI models can run sophisticated image analysis, semantic search, and auto-tagging directly on your machine—no upload required."
      },
      {
        type: "paragraph",
        text: "This approach leverages several technological advances: efficient neural network architectures, optimized inference engines, and clever hybrid designs that use cloud resources only when necessary (and never for your actual image data). The result is AI-powered organization that rivals cloud services in capability while keeping your files exactly where they belong—on your hardware."
      },
      {
        type: "heading",
        text: "How It Actually Works"
      },
      {
        type: "paragraph",
        text: "When you import images into a privacy-first system, here's what happens: Images are processed locally by on-device AI models that generate embeddings and tags. These metadata live alongside your images in a local database. When you search, the query is processed locally against this database. Your actual image pixels never travel over the network."
      },
      {
        type: "paragraph",
        text: "Some systems use a hybrid approach where lightweight cloud processing helps with initial tagging, but only text embeddings—not your actual images—ever leave your device. Even then, these embeddings are mathematical representations that can't be reverse-engineered to recreate your original images."
      },
      {
        type: "heading",
        text: "Benefits Beyond Privacy"
      },
      {
        type: "paragraph",
        text: "Local-first architecture delivers advantages that extend beyond security:"
      },
      {
        type: "list",
        items: [
          "Speed: Local searches happen in milliseconds, not seconds",
          "Offline access: Your entire library is fully functional without internet",
          "No subscriptions: Pay once for software, not monthly for storage",
          "True ownership: Your data stays in formats you control",
          "Customization: Local AI can be fine-tuned to your specific workflow"
        ]
      },
      {
        type: "heading",
        text: "The Trade-offs"
      },
      {
        type: "paragraph",
        text: "Privacy-first approaches do require more local storage and computing power. Initial setup involves downloading AI models (typically a few gigabytes). And while local AI has improved dramatically, the absolute cutting-edge models may still require cloud resources for specific tasks."
      },
      {
        type: "paragraph",
        text: "However, for most creative professionals, these trade-offs are more than acceptable. The peace of mind knowing your client work will never appear in someone else's AI training set, or that a service shutdown won't lock you out of years of organized work, is invaluable. Privacy isn't just a feature—it's the foundation of professional image management."
      }
    ],
    contentZh: [
      {
        type: "paragraph",
        text: "在一个数据泄露每周成为头条、云服务通过用户内容获利的时代，隐私已成为创意专业人士的关键关注点。你的图片库不仅仅是一堆文件——它是你的知识产权、你的创作过程，通常是你的生计。向隐私优先的本地AI图片管理的转变代表了对技术如何为创作者服务的基本重新思考。"
      },
      {
        type: "heading",
        text: "云端优先AI的问题"
      },
      {
        type: "paragraph",
        text: "大多数AI驱动的图片工具需要将你的整个库上传到远程服务器。虽然方便，但这带来了几个风险："
      },
      {
        type: "list",
        items: [
          "数据泄露：即使大型科技公司也会经历安全事件",
          "服务依赖：如果服务关闭或改变定价，你的工作流程就会中断",
          "内容分析：上传的图片可能被用于训练AI模型或投放广告",
          "管辖权问题：你的数据可能存储在具有不同隐私法律的国家",
          "同步冲突：跨设备管理大型媒体库会产生版本控制噩梦"
        ]
      },
      {
        type: "paragraph",
        text: "对于处理客户工作、未发布产品或敏感材料的专业人士来说，这些不是理论上的担忧——它们是交易破坏者。"
      },
      {
        type: "heading",
        text: "本地优先的替代方案"
      },
      {
        type: "paragraph",
        text: "隐私优先的图片管理颠覆了剧本。不是将数据发送到AI，而是让AI来到你的数据中。现代本地AI模型可以直接在你的机器上运行复杂的图片分析、语义搜索和自动打标——无需上传。"
      },
      {
        type: "paragraph",
        text: "这种方法利用了几项技术进步：高效的神经网络架构、优化的推理引擎，以及巧妙的混合设计，只在必要时使用云资源（而且从不用于你的实际图片数据）。结果是AI驱动的组织能力堪比云服务，同时让你的文件保持在它们应该在的地方——在你的硬件上。"
      },
      {
        type: "heading",
        text: "实际如何工作"
      },
      {
        type: "paragraph",
        text: "当你将图片导入隐私优先系统时，会发生以下情况：图片由设备上的AI模型本地处理，生成嵌入和标签。这些元数据与图片一起存储在本地数据库中。当你搜索时，查询在本地针对该数据库处理。你的实际图片像素永远不会通过网络传输。"
      },
      {
        type: "paragraph",
        text: "一些系统使用混合方法，轻量级云处理有助于初始打标，但只有文本嵌入——而不是你的实际图片——会离开你的设备。即便如此，这些嵌入也是数学表示，无法被逆向工程以重现你的原始图片。"
      },
      {
        type: "heading",
        text: "超越隐私的好处"
      },
      {
        type: "paragraph",
        text: "本地优先架构提供了超越安全性的优势："
      },
      {
        type: "list",
        items: [
          "速度：本地搜索在毫秒级完成，而不是秒",
          "离线访问：你的整个库在没有网络的情况下完全可用",
          "无订阅：为软件付费一次，而不是每月为存储付费",
          "真正的所有权：你的数据保持在你控制的格式中",
          "可定制性：本地AI可以根据你的特定工作流程进行微调"
        ]
      },
      {
        type: "heading",
        text: "权衡"
      },
      {
        type: "paragraph",
        text: "隐私优先的方法确实需要更多的本地存储和计算能力。初始设置涉及下载AI模型（通常几千兆字节）。虽然本地AI已经显著改进，但绝对尖端的模型可能仍然需要云资源来完成特定任务。"
      },
      {
        type: "paragraph",
        text: "然而，对于大多数创意专业人士来说，这些权衡是完全可以接受的。知道你的客户工作永远不会出现在别人的AI训练集中，或者服务关闭不会将你锁定在多年组织的工作之外，这种安心感是无价的。隐私不仅仅是一个功能——它是专业图片管理的基础。"
      }
    ]
  },
  "offline-ai-image-analysis": {
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
    content: [
      {
        type: "paragraph",
        text: "Picture this: You're on a long flight, preparing for a client presentation, and need to find that specific mood board image from three years ago. No Wi-Fi, no hotspot, no problem. With offline AI image analysis, your entire visual library is at your fingertips—intelligent search, smart tagging, and instant results, all running locally on your laptop. This isn't science fiction; it's the reality of modern edge AI."
      },
      {
        type: "heading",
        text: "Why Offline Matters"
      },
      {
        type: "paragraph",
        text: "The assumption that we're always connected has shaped most modern software, but creative professionals know better. We work on planes, in remote locations, in studios with spotty connectivity, or simply prefer the focus that comes from disconnecting. Offline capability isn't a nice-to-have—it's essential for serious work."
      },
      {
        type: "paragraph",
        text: "Beyond convenience, offline processing offers practical advantages: zero latency, no bandwidth costs, and complete privacy. But how do you get cloud-level AI intelligence running on a laptop? The answer lies in a combination of model optimization, efficient architectures, and clever engineering."
      },
      {
        type: "heading",
        text: "The Technology Behind Local AI"
      },
      {
        type: "paragraph",
        text: "Modern local AI image analysis relies on several key innovations:"
      },
      {
        type: "list",
        items: [
          "Model quantization: Reducing precision from 32-bit to 8-bit or 4-bit numbers dramatically shrinks model size with minimal accuracy loss",
          "Knowledge distillation: Training smaller 'student' models to mimic larger 'teacher' models, preserving capability while reducing compute requirements",
          "Efficient architectures: Models like CLIP and MobileViT are designed specifically for edge deployment",
          "Hardware acceleration: Leveraging Apple Silicon's Neural Engine, NVIDIA GPUs, or Intel NPUs for optimized inference",
          "Embedding caching: Pre-computing image embeddings so search requires only query processing"
        ]
      },
      {
        type: "paragraph",
        text: "The result is AI that can run on consumer hardware with impressive performance. A modern MacBook Pro can process thousands of images per hour, generating embeddings that enable sub-100ms semantic search across libraries of 100,000+ images."
      },
      {
        type: "heading",
        text: "Architecture of an Offline System"
      },
      {
        type: "paragraph",
        text: "A typical offline AI image management system has three core components: The Embedding Generator converts images into numerical representations (embeddings) that capture their visual and semantic content. The Vector Database stores these embeddings locally with specialized indexes for fast similarity search. The Query Processor converts your search terms into the same embedding space and finds nearest neighbors."
      },
      {
        type: "paragraph",
        text: "All of this happens on your device. The embedding model might be a few hundred megabytes, the vector database typically uses efficient formats like FAISS or HNSW, and the entire pipeline is optimized for local hardware acceleration."
      },
      {
        type: "heading",
        text: "Performance in Practice"
      },
      {
        type: "paragraph",
        text: "Real-world benchmarks demonstrate how capable offline AI has become. On an M3 MacBook Pro:"
      },
      {
        type: "list",
        items: [
          "Initial embedding generation: ~50-100 images per second",
          "Semantic search across 50,000 images: < 50ms",
          "Similar image finding: < 20ms",
          "Memory footprint: ~2-4GB for full working set",
          "Library size supported: Millions of images with appropriate indexing"
        ]
      },
      {
        type: "paragraph",
        text: "These numbers rival or exceed cloud-based solutions for most use cases, especially when you factor in network latency."
      },
      {
        type: "heading",
        text: "The Future is Local"
      },
      {
        type: "paragraph",
        text: "As edge computing hardware continues to improve and model optimization techniques advance, the gap between cloud and local AI narrows. Apple's Neural Engine, Intel's NPUs, and dedicated AI chips in modern devices are purpose-built for this workload."
      },
      {
        type: "paragraph",
        text: "For creative professionals, this trend means freedom. Freedom to work anywhere, knowing your tools are as capable on a remote mountaintop as in a connected office. Freedom from subscription models that hold your data hostage. And freedom to organize and search your visual world at the speed of thought—no internet required."
      }
    ],
    contentZh: [
      {
        type: "paragraph",
        text: "想象一下：你在长途飞行中，准备客户演示，需要找到三年前那个特定的情绪板图片。没有Wi-Fi，没有热点，没问题。有了离线AI图片分析，你的整个视觉库触手可及——智能搜索、智能打标和即时结果，全部在你的笔记本上本地运行。这不是科幻小说；这是现代边缘AI的现实。"
      },
      {
        type: "heading",
        text: "为什么离线很重要"
      },
      {
        type: "paragraph",
        text: "我们总是保持连接的假设塑造了大多数现代软件，但创意专业人士知道并非如此。我们在飞机上、偏远地区、连接不稳定的演播室工作，或者只是更喜欢断开连接带来的专注。离线能力不是一个 nice-to-have 的功能——它对严肃的工作至关重要。"
      },
      {
        type: "paragraph",
        text: "除了便利之外，离线处理还提供实际优势：零延迟、无带宽成本和完全隐私。但如何在笔记本电脑上获得云级别的AI智能呢？答案在于模型优化、高效架构和巧妙工程的结合。"
      },
      {
        type: "heading",
        text: "本地AI背后的技术"
      },
      {
        type: "paragraph",
        text: "现代本地AI图片分析依赖于几项关键创新："
      },
      {
        type: "list",
        items: [
          "模型量化：将精度从32位降低到8位或4位数字，在最小精度损失的情况下大幅缩小模型大小",
          "知识蒸馏：训练较小的'学生'模型来模仿较大的'教师'模型，在减少计算需求的同时保持能力",
          "高效架构：像CLIP和MobileViT这样的模型专为边缘部署而设计",
          "硬件加速：利用Apple Silicon的神经引擎、NVIDIA GPU或Intel NPU进行优化推理",
          "嵌入缓存：预计算图片嵌入，使搜索只需要处理查询"
        ]
      },
      {
        type: "paragraph",
        text: "结果是AI可以在消费硬件上以令人印象深刻的性能运行。一台现代MacBook Pro每小时可以处理数千张图片，生成支持在100,000多张图片库中进行低于100毫秒语义搜索的嵌入。"
      },
      {
        type: "heading",
        text: "离线系统的架构"
      },
      {
        type: "paragraph",
        text: "一个典型的离线AI图片管理系统有三个核心组件：嵌入生成器将图片转换为捕获其视觉和语义内容的数字表示（嵌入）。向量数据库在本地存储这些嵌入，并使用专门的索引进行快速相似性搜索。查询处理器将你的搜索词转换为相同的嵌入空间，并找到最近的邻居。"
      },
      {
        type: "paragraph",
        text: "所有这些都发生在你的设备上。嵌入模型可能只有几百兆字节，向量数据库通常使用FAISS或HNSW等高效格式，整个管道都针对本地硬件加速进行了优化。"
      },
      {
        type: "heading",
        text: "实践中的性能"
      },
      {
        type: "paragraph",
        text: "真实世界的基准测试展示了离线AI的能力。在M3 MacBook Pro上："
      },
      {
        type: "list",
        items: [
          "初始嵌入生成：每秒约50-100张图片",
          "在50,000张图片中进行语义搜索：< 50毫秒",
          "相似图片查找：< 20毫秒",
          "内存占用：完整工作集约2-4GB",
          "支持的库大小：通过适当的索引支持数百万张图片"
        ]
      },
      {
        type: "paragraph",
        text: "这些数字在大多数情况下与基于云的解决方案相当或超越，特别是当你考虑到网络延迟时。"
      },
      {
        type: "heading",
        text: "未来是本地的"
      },
      {
        type: "paragraph",
        text: "随着边缘计算硬件的持续改进和模型优化技术的进步，云和本地AI之间的差距正在缩小。Apple的神经引擎、Intel的NPU和现代设备中的专用AI芯片都是为这种工作负载而专门构建的。"
      },
      {
        "type": "paragraph",
        "text": "对于创意专业人士来说，这一趋势意味着自由。无论身在何处都能自由工作的自由——无论是在偏远山顶还是联网办公室，工具都能同样强大。从将数据作为人质的订阅模式中解放出来。以及以思维速度组织和搜索视觉世界的自由——无需互联网。"
      }
    ]
  },
  "brain-inspired-image-organization": {
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
    content: [
      {
        type: "paragraph",
        text: "The human brain doesn't organize memories into folders. When you recall a vacation, you don't navigate to /Memories/2023/Summer/Beach_Trip.jpg. Instead, your brain activates a rich web of associations—sounds, smells, emotions, visual fragments—that reconstruct the experience. This associative, semantic approach to memory is the inspiration behind modern AI-powered image organization."
      },
      {
        type: "heading",
        text: "How Memory Actually Works"
      },
      {
        type: "paragraph",
        text: "Cognitive scientists have long understood that human memory is reconstructive, not reproductive. We don't store perfect copies of experiences; we store patterns, connections, and abstractions. When remembering, the brain activates neural pathways that were involved in the original experience, combining them with current context to create a coherent narrative."
      },
      {
        type: "paragraph",
        text: "This process is fundamentally different from computer file systems. Your brain uses distributed representation—memories aren't stored in single locations but as patterns of activation across networks of neurons. A single memory might involve visual cortex activation for images, auditory cortex for sounds, and hippocampus for temporal context."
      },
      {
        type: "heading",
        text: "Translating Biology to Software"
      },
      {
        type: "paragraph",
        text: "The field of artificial neural networks emerged from attempts to model this biological inspiration. Modern image organization systems apply these principles in several ways: Vector embeddings serve as the computational equivalent of distributed representations. Instead of storing images as files in folders, they're represented as points in high-dimensional space where semantically similar images cluster together."
      },
      {
        type: "paragraph",
        text: "Attention mechanisms mirror how the brain focuses on relevant information while filtering distractions. When you search for 'sunset over mountains,' the system attends to features relevant to that concept while downweighting irrelevant attributes."
      },
      {
        type: "heading",
        text: "The Hybrid Brain Architecture"
      },
      {
        type: "paragraph",
        text: "Perhaps the most direct brain inspiration appears in hybrid AI architectures. The human brain consists of specialized subsystems: the amygdala for emotion, the visual cortex for processing imagery, the prefrontal cortex for executive function. These systems communicate but maintain specialization."
      },
      {
        type: "paragraph",
        text: "Similarly, a hybrid image organization system uses specialized 'brain regions': A perception module (like the visual cortex) that processes and understands image content. A semantic memory module (like the temporal lobe) that stores and retrieves conceptual associations. An executive module (like the prefrontal cortex) that coordinates search and organization tasks."
      },
      {
        type: "heading",
        text: "Why This Approach Works Better"
      },
      {
        type: "paragraph",
        text: "The brain-inspired approach aligns with how humans naturally think about images. When you want to find 'photos from that rainy day in Paris,' you're not thinking about filenames or dates—you're activating a mental representation of that experience."
      },
      {
        type: "list",
        items: [
          "Graceful degradation: Like human memory, losing some connections doesn't break the entire system",
          "Context sensitivity: Search results adapt based on your current project and recent activity",
          "Cross-modal associations: Finding images based on emotional tone, not just visual content",
          "Pattern completion: Suggesting images that complete a mood board or visual narrative",
          "Natural exploration: Supporting discovery through association rather than rigid hierarchies"
        ]
      },
      {
        type: "heading",
        text: "The Future of Cognitive Software"
      },
      {
        type: "paragraph",
        text: "As we learn more about how the brain processes and retrieves visual information, these insights continue to shape software design. The goal isn't just to store images efficiently—it's to create systems that think about visual content in ways that complement human cognition."
      },
      {
        type: "paragraph",
        text: "For creative professionals, this means tools that feel less like databases and more like extensions of memory. You shouldn't have to remember where you filed something; you should simply think about what you're looking for, and the system should understand. In this vision, technology doesn't replace human creativity—it augments it, handling the cognitive load of organization so you can focus on creation."
      }
    ],
    contentZh: [
      {
        type: "paragraph",
        text: "人类的大脑不会将记忆组织到文件夹中。当你回忆假期时，你不会导航到/记忆/2023/夏天/海滩之旅.jpg。相反，你的大脑激活一个丰富的联想网络——声音、气味、情感、视觉片段——来重建体验。这种联想的、语义的记忆方法是现代AI驱动图片组织的灵感来源。"
      },
      {
        type: "heading",
        text: "记忆实际如何工作"
      },
      {
        type: "paragraph",
        text: "认知科学家早就明白，人类记忆是重建性的，而不是复制性的。我们不存储经验的完美副本；我们存储模式、连接和抽象。当回忆时，大脑激活参与原始经验的神经通路，将它们与当前环境结合，创造一个连贯的叙述。"
      },
      {
        type: "paragraph",
        text: "这个过程与计算机文件系统根本不同。你的大脑使用分布式表示——记忆不是存储在单个位置，而是作为神经元网络中的激活模式。一个单一的记忆可能涉及视觉皮层激活图像、听觉皮层处理声音、海马体处理时间环境。"
      },
      {
        type: "heading",
        text: "从生物学转化为软件"
      },
      {
        type: "paragraph",
        text: "人工神经网络领域源于模拟这种生物学灵感的尝试。现代图片组织系统以几种方式应用这些原则：向量嵌入作为分布式表示的计算等价物。不是将图片作为文件存储在文件夹中，而是将它们表示为高维空间中的点，在那里语义相似的图片聚集在一起。"
      },
      {
        type: "paragraph",
        text: "注意力机制反映了大脑如何专注于相关信息同时过滤干扰。当你搜索'山脉上的日落'时，系统关注与该概念相关的特征，同时降低不相关属性的权重。"
      },
      {
        type: "heading",
        text: "混合大脑架构"
      },
      {
        type: "paragraph",
        text: "也许最直接的脑部灵感出现在混合AI架构中。人类大脑由专门的子系统组成：杏仁核处理情感、视觉皮层处理图像、前额叶皮层处理执行功能。这些系统相互通信但保持专业化。"
      },
      {
        type: "paragraph",
        text: "同样，混合图片组织系统使用专门的'脑区'：感知模块（像视觉皮层）处理和理解的图像内容。语义记忆模块（像颞叶）存储和检索概念关联。执行模块（像前额叶皮层）协调搜索和组织任务。"
      },
      {
        type: "heading",
        text: "为什么这种方法效果更好"
      },
      {
        type: "paragraph",
        text: "受大脑启发的方法与人类自然思考图片的方式一致。当你想要找到'巴黎那个雨天的照片'时，你不是在考虑文件名或日期——你是在激活那种体验的心理表征。"
      },
      {
        type: "list",
        items: [
          "优雅降级：像人类记忆一样，失去一些连接不会破坏整个系统",
          "情境敏感：搜索结果根据你当前的项目和最近活动进行适配",
          "跨模态关联：基于情感基调而非仅视觉内容查找图片",
          "模式补全：建议完成情绪板或视觉叙事的图片",
          "自然探索：通过联想而非严格层级支持发现"
        ]
      },
      {
        type: "heading",
        text: "认知软件的未来"
      },
      {
        type: "paragraph",
        text: "随着我们对大脑如何处理和检索视觉信息的了解不断增加，这些见解继续塑造软件设计。目标不仅仅是高效存储图片——而是创建以补充人类认知的方式思考视觉内容的系统。"
      },
      {
        type: "paragraph",
        text: "对于创意专业人士来说，这意味着感觉不那么像数据库、更像记忆延伸的工具。你不应该必须记住你把东西归档在哪里；你应该简单地思考你在找什么，系统应该理解。在这个愿景中，技术不会取代人类创造力——它增强创造力，处理组织的认知负担，让你专注于创作。"
      }
    ]
  },
  "10-best-ai-photo-organizers-2025": {
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
    content: [
      {
        type: "paragraph",
        text: "The market for AI-powered photo organizers has exploded in recent years, with dozens of solutions promising to revolutionize how creative professionals manage their visual libraries. But with so many options, how do you choose? We've tested the leading contenders to bring you this comprehensive comparison, focusing on what matters most to working designers, photographers, and creative directors."
      },
      {
        type: "heading",
        text: "What We Looked For"
      },
      {
        type: "paragraph",
        text: "Our evaluation criteria focused on professional needs:"
      },
      {
        type: "list",
        items: [
          "AI accuracy: Quality of auto-tagging and search results",
          "Privacy: Where your data lives and who can access it",
          "Performance: Speed of import, search, and browsing",
          "Workflow integration: How well it fits existing creative tools",
          "Value: Pricing relative to features provided"
        ]
      },
      {
        type: "heading",
        text: "The Contenders"
      },
      {
        type: "heading",
        text: "1. InspiraDB"
      },
      {
        type: "paragraph",
        text: "Best for: Privacy-conscious creatives who need semantic search. InspiraDB's hybrid cloud-local architecture delivers powerful AI tagging while keeping your actual images on your device. Semantic search is genuinely impressive—finding images based on concepts, not just keywords. The offline capability and one-time purchase model make it ideal for professionals who value both privacy and ownership."
      },
      {
        type: "heading",
        text: "2. Adobe Lightroom"
      },
      {
        type: "paragraph",
        text: "Best for: Photographers already in the Adobe ecosystem. Lightroom's AI search (Adobe Sensei) works well for common objects and scenes, and the integration with Photoshop is seamless. However, cloud storage costs add up quickly, and the subscription model may not suit everyone. Search is good but not truly semantic."
      },
      {
        type: "heading",
        text: "3. Peakto"
      },
      {
        type: "paragraph",
        text: "Best for: Users with scattered libraries across multiple platforms. Peakto aggregates photos from Lightroom, Capture One, folders, and cloud services into a unified view with AI categorization. The multi-catalog approach is unique, though the AI capabilities aren't as advanced as some competitors."
      },
      {
        type: "heading",
        text: "4. Mylio Photos"
      },
      {
        type: "paragraph",
        text: "Best for: Users needing robust sync across devices. Mylio's peer-to-peer syncing keeps devices in sync without relying on cloud storage. AI features are basic but functional. The interface feels dated, and advanced AI search is missing."
      },
      {
        type: "heading",
        text: "5. Tonfotos"
      },
      {
        type: "paragraph",
        text: "Best for: Family photo organizers on a budget. Tonfotos offers face recognition and basic AI features at a reasonable price. However, it lacks the sophisticated semantic search and professional workflow features that working creatives need."
      },
      {
        type: "heading",
        text: "6. DigiKam"
      },
      {
        type: "paragraph",
        text: "Best for: Open-source enthusiasts. This free, open-source option offers powerful organization tools and basic face recognition. The AI features lag behind commercial offerings, and the interface requires a learning curve."
      },
      {
        type: "heading",
        text: "7. Luminar Neo"
      },
      {
        type: "paragraph",
        text: "Best for: AI-powered editing plus basic organization. While primarily an editor, Luminar Neo includes catalog features and some AI organization capabilities. Not suitable as a primary organizer for large libraries."
      },
      {
        type: "heading",
        text: "8. Apple Photos"
      },
      {
        type: "paragraph",
        text: "Best for: Casual users in the Apple ecosystem. The built-in AI search works surprisingly well for basic queries, and iCloud integration is seamless. However, limited export options and basic organization tools make it unsuitable for professional workflows."
      },
      {
        type: "heading",
        text: "9. Gemini 2"
      },
      {
        type: "paragraph",
        text: "Best for: Duplicate detection and cleanup. While not a full organizer, Gemini 2 excels at finding duplicates and similar images to free up space. Consider it a companion tool rather than a primary solution."
      },
      {
        type: "heading",
        text: "10. PhotoSweeper"
      },
      {
        type: "paragraph",
        text: "Best for: Rapid duplicate cleanup. Like Gemini, this is a specialized tool for finding and removing duplicates. Fast and effective, but not a complete organization solution."
      },
      {
        type: "heading",
        text: "Our Recommendation"
      },
      {
        type: "paragraph",
        text: "For most creative professionals, the choice comes down to priorities. If privacy and offline capability are paramount, InspiraDB leads the pack with its genuine semantic search and local-first approach. If you're already invested in Adobe's ecosystem and don't mind subscriptions, Lightroom remains a solid choice. For those with scattered libraries, Peakto offers a unique solution."
      },
      {
        type: "paragraph",
        text: "The key takeaway: AI photo organization has matured significantly. The gap between cloud and local solutions has narrowed, semantic search is becoming standard, and creative professionals have more options than ever to keep their visual libraries organized and accessible."
      }
    ],
    contentZh: [
      {
        type: "paragraph",
        text: "近年来，AI驱动的照片管理工具市场呈爆炸式增长，数十种解决方案承诺彻底改变创意专业人士管理视觉库的方式。但有这么多选择，如何选择呢？我们测试了领先的竞争者，为你带来这份全面的对比，重点关注对工作的设计师、摄影师和创意总监最重要的因素。"
      },
      {
        type: "heading",
        text: "我们的评估标准"
      },
      {
        type: "paragraph",
        text: "我们的评估标准专注于专业需求："
      },
      {
        type: "list",
        items: [
          "AI准确性：自动打标和搜索结果的质量",
          "隐私：你的数据存储在哪里以及谁可以访问",
          "性能：导入、搜索和浏览的速度",
          "工作流程集成：它与现有创意工具的契合程度",
          "价值：相对于提供的功能的价格"
        ]
      },
      {
        type: "heading",
        text: "竞争者"
      },
      {
        type: "heading",
        text: "1. InspiraDB"
      },
      {
        type: "paragraph",
        text: "最适合：注重隐私、需要语义搜索的创意人士。InspiraDB的混合云本地架构提供强大的AI打标，同时保持你的实际图片在设备上。语义搜索确实令人印象深刻——基于概念而非仅关键词查找图片。离线功能和一次性购买模式使其成为重视隐私和所有权的专业人士的理想选择。"
      },
      {
        type: "heading",
        text: "2. Adobe Lightroom"
      },
      {
        type: "paragraph",
        text: "最适合：已经在Adobe生态系统中的摄影师。Lightroom的AI搜索（Adobe Sensei）对常见物体和场景效果很好，与Photoshop的集成无缝。然而，云存储成本迅速累积，订阅模式可能不适合所有人。搜索不错，但不是真正的语义搜索。"
      },
      {
        type: "heading",
        text: "3. Peakto"
      },
      {
        type: "paragraph",
        text: "最适合：在多个平台上分散库的用户。Peakto将Lightroom、Capture One、文件夹和云服务中的照片聚合到一个统一视图中，并进行AI分类。多目录方法是独特的，尽管AI能力不如一些竞争对手先进。"
      },
      {
        type: "heading",
        text: "4. Mylio Photos"
      },
      {
        type: "paragraph",
        text: "最适合：需要在设备间进行稳健同步的用户。Mylio的点对点同步使设备保持同步，而不依赖云存储。AI功能是基本的但可用的。界面感觉过时，缺少高级AI搜索。"
      },
      {
        type: "heading",
        text: "5. Tonfotos"
      },
      {
        type: "paragraph",
        text: "最适合：预算有限的家庭照片组织者。Tonfotos以合理的价格提供人脸识别和基本AI功能。然而，它缺乏复杂语义搜索和工作创意人士需要的专业工作流程功能。"
      },
      {
        type: "heading",
        text: "6. DigiKam"
      },
      {
        type: "paragraph",
        text: "最适合：开源爱好者。这个免费的开源选项提供强大的组织工具和基本人脸识别。AI功能落后于商业产品，界面需要学习曲线。"
      },
      {
        type: "heading",
        text: "7. Luminar Neo"
      },
      {
        type: "paragraph",
        text: "最适合：AI驱动编辑加基本组织。虽然主要是一个编辑器，Luminar Neo包括目录功能和一些AI组织能力。不适合作为大库的主要管理工具。"
      },
      {
        type: "heading",
        text: "8. Apple Photos"
      },
      {
        type: "paragraph",
        text: "最适合：Apple生态系统中的休闲用户。内置的AI搜索对基本查询 surprisingly 效果很好，iCloud集成无缝。然而，有限的导出选项和基本的组织工具使其不适合专业工作流程。"
      },
      {
        type: "heading",
        text: "9. Gemini 2"
      },
      {
        type: "paragraph",
        text: "最适合：重复检测和清理。虽然不是完整的组织工具，Gemini 2擅长查找重复和相似图片以释放空间。将其视为配套工具而非主要解决方案。"
      },
      {
        type: "heading",
        text: "10. PhotoSweeper"
      },
      {
        type: "paragraph",
        text: "最适合：快速重复清理。像Gemini一样，这是一个用于查找和删除重复项的专门工具。快速有效，但不是完整的组织解决方案。"
      },
      {
        type: "heading",
        text: "我们的推荐"
      },
      {
        type: "paragraph",
        text: "对于大多数创意专业人士来说，选择取决于优先事项。如果隐私和离线能力至关重要，InspiraDB以其真正的语义搜索和本地优先方法领先。如果你已经投资于Adobe的生态系统并且不介意订阅，Lightroom仍然是一个可靠的选择。对于那些库分散的人来说，Peakto提供了独特的解决方案。"
      },
      {
        type: "paragraph",
        text: "关键要点：AI照片组织已经显著成熟。云和本地解决方案之间的差距已经缩小，语义搜索正在成为标准，创意专业人士比以往任何时候都有更多选择来保持他们的视觉库有序和可访问。"
      }
    ]
  }
};

interface ContentBlock {
  type: "paragraph" | "heading" | "list";
  text?: string;
  items?: string[];
}

interface BlogPost {
  slug: string;
  title: string;
  titleZh: string;
  excerpt: string;
  excerptZh: string;
  category: string;
  categoryZh: string;
  date: string;
  readTime: string;
  readTimeZh: string;
  content: ContentBlock[];
  contentZh: ContentBlock[];
}

interface BlogPostPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = (locales.includes(localeParam as Locale) ? localeParam : defaultLocale) as Locale;
  const isZh = locale === "zh";

  const post = blogPostsContent[slug];

  if (!post) {
    notFound();
  }

  const content = isZh ? post.contentZh : post.content;

  return (
    <I18nProvider locale={locale}>
      <Navigation />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container max-w-4xl">
            <Link href={`/${locale}/blog/`}>
              <Button variant="ghost" size="sm" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {isZh ? "返回博客" : "Back to Blog"}
              </Button>
            </Link>
            <Badge variant="secondary" className="mb-4">
              {isZh ? post.categoryZh : post.category}
            </Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {isZh ? post.titleZh : post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{post.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{isZh ? post.readTimeZh : post.readTime}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="container max-w-3xl">
            <article className="prose prose-lg max-w-none">
              {content.map((block, index) => {
                switch (block.type) {
                  case "paragraph":
                    return (
                      <p key={index} className="text-muted-foreground leading-relaxed mb-6">
                        {block.text}
                      </p>
                    );
                  case "heading":
                    return (
                      <h2 key={index} className="text-2xl font-semibold mt-12 mb-4">
                        {block.text}
                      </h2>
                    );
                  case "list":
                    return (
                      <ul key={index} className="list-disc list-inside space-y-2 mb-6 text-muted-foreground">
                        {block.items?.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    );
                  default:
                    return null;
                }
              })}
            </article>

            <Separator className="my-12" />

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Link href={`/${locale}/blog/`}>
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {isZh ? "返回所有文章" : "Back to All Posts"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </I18nProvider>
  );
}

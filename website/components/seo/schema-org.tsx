"use client";

import Script from "next/script";

interface SchemaOrgProps {
  locale: string;
}

export function SchemaOrg({ locale }: SchemaOrgProps) {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "InspiraDB",
    "applicationCategory": "GraphicsApplication",
    "operatingSystem": "macOS",
    "offers": {
      "@type": "Offer",
      "price": "49.00",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "127"
    },
    "description": locale === "zh"
      ? "AI驱动的本地图片管理工具，支持语义搜索和自动打标。100%离线，隐私优先。"
      : "AI-powered local image management with semantic search and auto-tagging. 100% offline, privacy-first.",
    "featureList": [
      "AI Auto-Tagging",
      "Semantic Search",
      "100% Offline",
      "Privacy First",
      "Cloud-Local Hybrid AI"
    ],
    "softwareVersion": "1.0.0",
    "url": "https://www.inspiradb.com"
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "InspiraDB",
    "url": "https://www.inspiradb.com",
    "logo": "https://www.inspiradb.com/logo.png",
    "sameAs": [
      "https://twitter.com/inspiradb",
      "https://github.com/inspiradb"
    ]
  };

  return (
    <>
      <Script
        id="schema-software"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <Script
        id="schema-organization"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </>
  );
}

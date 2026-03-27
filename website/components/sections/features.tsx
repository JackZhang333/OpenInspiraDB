"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Search, WifiOff, Shield, CloudLightning } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const features = [
  {
    key: "aiTagging",
    icon: Brain,
  },
  {
    key: "semanticSearch",
    icon: Search,
  },
  {
    key: "offline",
    icon: WifiOff,
  },
  {
    key: "privacy",
    icon: Shield,
  },
  {
    key: "hybrid",
    icon: CloudLightning,
  },
];

export function FeaturesSection() {
  const { t } = useI18n();

  return (
    <section className="py-24 bg-muted/30">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("features.title") as string}</h2>
          <p className="text-lg text-muted-foreground">{t("features.subtitle") as string}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.key} className="group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{t(`features.${feature.key}.title`) as string}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {t(`features.${feature.key}.description`) as string}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

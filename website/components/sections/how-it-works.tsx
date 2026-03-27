"use client";

import { Upload, Sparkles, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const steps = [
  { key: "step1", icon: Upload },
  { key: "step2", icon: Sparkles },
  { key: "step3", icon: Search },
];

export function HowItWorksSection() {
  const { t } = useI18n();

  return (
    <section className="py-24">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("howItWorks.title") as string}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="relative text-center">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-border" />
                )}

                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t(`howItWorks.${step.key}.title`) as string}</h3>
                <p className="text-muted-foreground">{t(`howItWorks.${step.key}.description`) as string}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

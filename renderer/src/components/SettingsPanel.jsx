import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Key, X } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { Button } from './ui/button.jsx';

const AI_PROVIDERS = [
  { id: 'zhipu', name: '智谱 AI', desc: '预留云端模型配置' },
  { id: 'mock', name: 'Mock AI', desc: '本地演示分析服务' },
];

export function SettingsPanel({ open, settings, saving, onSave, onClose }) {
  const [formData, setFormData] = useState({
    provider: 'zhipu',
    apiKey: '',
    ...settings,
  });
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        provider: settings.provider || 'zhipu',
        apiKey: settings.apiKey || '',
      });
    }
  }, [settings]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-clay/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">设置</h2>
            <p className="text-[12px] text-ink/50">配置 AI 服务和本地偏好</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/40 hover:bg-clay/10 hover:text-ink/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="space-y-3">
            <label className="text-[13px] font-medium text-ink/70">AI 服务</label>
            <div className="grid grid-cols-2 gap-3">
              {AI_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => setFormData((current) => ({ ...current, provider: provider.id }))}
                  className={cn(
                    'relative flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                    formData.provider === provider.id
                      ? 'border-moss bg-moss/5 ring-1 ring-moss'
                      : 'border-clay/20 hover:border-clay/40',
                  )}
                >
                  <span className="text-[13px] font-medium text-ink">{provider.name}</span>
                  <span className="mt-0.5 text-[11px] text-ink/50">{provider.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-ink/70">API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(event) => setFormData((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder="可选：输入云端模型 API Key"
                className={cn(
                  'h-10 w-full rounded-lg border border-clay/20 pl-10 pr-10 text-[13px] text-ink placeholder:text-ink/30',
                  'focus:border-moss/30 focus:outline-none focus:ring-2 focus:ring-moss/20',
                )}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-ink/40">当前版本会把配置保存到本地应用数据目录。</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-clay/10 bg-ink/[0.02] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSave?.(formData)} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

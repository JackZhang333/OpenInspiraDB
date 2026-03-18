import React, { useState, useCallback } from 'react';
import { AppSidebar } from './components/AppSidebar.jsx';
import { LibraryWorkspace } from './components/LibraryWorkspace.jsx';
import { DetailPanel } from './components/DetailPanel.jsx';
import { SettingsPanel } from './components/SettingsPanel.jsx';

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    provider: 'zhipu',
    apiKey: '',
  });

  // 素材列表状态
  const [mediaList, setMediaList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 筛选后的素材列表
  const filteredMedia = mediaList.filter((media) => {
    if (selectedTag) {
      return media.tags?.includes(selectedTag);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        media.caption?.toLowerCase().includes(query) ||
        media.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        media.filename?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // 切换侧边栏折叠
  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  // 导入文件夹
  const handleImportFolder = useCallback(async () => {
    if (importing) return;

    try {
      setImporting(true);
      setImportProgress({ mode: 'folder', current: 0, total: 0, phase: 'scanning' });

      const result = await window.inspira?.selectFolder?.();
      if (!result) {
        setImporting(false);
        setImportProgress(null);
        return;
      }

      // 模拟进度更新
      const files = result.files || [];
      setImportProgress({
        mode: 'folder',
        current: 0,
        total: files.length,
        phase: 'analyzing',
        importedCount: 0,
        analyzingCount: 0,
        readyCount: 0,
        failedCount: 0,
        duplicateCount: 0,
      });

      // 实际导入逻辑应该在这里
      // 这里简化处理，实际应该调用后端 API
      setTimeout(() => {
        setImporting(false);
        setImportProgress(null);
        // 刷新列表
      }, 2000);
    } catch (error) {
      console.error('导入失败:', error);
      setImporting(false);
      setImportProgress(null);
    }
  }, [importing]);

  // 导入文件
  const handleImportFile = useCallback(async () => {
    if (importing) return;

    try {
      setImporting(true);
      setImportProgress({ mode: 'file', current: 0, total: 1 });

      const result = await window.inspira?.selectFiles?.();
      if (!result) {
        setImporting(false);
        setImportProgress(null);
        return;
      }

      // 模拟进度
      setTimeout(() => {
        setImporting(false);
        setImportProgress(null);
      }, 1500);
    } catch (error) {
      console.error('导入失败:', error);
      setImporting(false);
      setImportProgress(null);
    }
  }, [importing]);

  // 选择标签
  const handleSelectTag = useCallback((tag) => {
    setSelectedTag(tag);
  }, []);

  // 清空标签筛选
  const handleClearTag = useCallback(() => {
    setSelectedTag(null);
  }, []);

  // 打开设置
  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // 保存设置
  const handleSaveSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    // 调用后端保存设置
    await window.inspira?.saveSettings?.(newSettings);
  }, []);

  // 选择素材
  const handleSelectMedia = useCallback((media) => {
    setSelectedId(media.id);
  }, []);

  // 关闭详情面板
  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  // 搜索
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // 保存元数据
  const handleSaveMetadata = useCallback(async (metadata) => {
    const media = mediaList.find((m) => m.id === selectedId);
    if (!media) return;

    // 调用后端保存
    await window.inspira?.updateMedia?.(selectedId, metadata);

    // 更新本地状态
    setMediaList((list) =>
      list.map((m) =>
        m.id === selectedId ? { ...m, ...metadata } : m
      )
    );
  }, [mediaList, selectedId]);

  // 删除素材
  const handleDelete = useCallback(async () => {
    if (!selectedId) return;

    await window.inspira?.deleteMedia?.(selectedId);
    setMediaList((list) => list.filter((m) => m.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // 刷新分析
  const handleRefresh = useCallback(async () => {
    if (!selectedId) return;

    setIsAnalyzing(true);
    await window.inspira?.reanalyze?.(selectedId);
    setIsAnalyzing(false);
  }, [selectedId]);

  // 获取当前选中的素材
  const selectedMedia = mediaList.find((m) => m.id === selectedId);

  return (
    <div className="flex h-screen w-full bg-[#f8faf6]">
      {/* 侧边栏 */}
      <div
        className="flex-shrink-0 transition-all duration-300"
        style={{ width: collapsed ? 64 : 240 }}
      >
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          importing={importing}
          importProgress={importProgress}
          onImportFolder={handleImportFolder}
          onImportFile={handleImportFile}
          availableTags={availableTags}
          selectedTag={selectedTag}
          onSelectTag={handleSelectTag}
          onClearTag={handleClearTag}
          onOpenSettings={handleOpenSettings}
        />
      </div>

      {/* 主工作区 */}
      <main className="flex-1 min-w-0">
        <LibraryWorkspace
          mediaList={filteredMedia}
          selectedId={selectedId}
          onSelectMedia={handleSelectMedia}
          onSearch={handleSearch}
          searchQuery={searchQuery}
          isAnalyzing={isAnalyzing}
        />
      </main>

      {/* 详情面板 */}
      {selectedMedia && (
        <DetailPanel
          media={selectedMedia}
          onClose={handleCloseDetail}
          onSave={handleSaveMetadata}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
        />
      )}

      {/* 设置弹窗 */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;

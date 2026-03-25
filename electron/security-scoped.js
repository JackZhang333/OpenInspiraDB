export function shouldUseSecurityScopedBookmarks({
  isMas = process.mas,
  platform = process.platform,
} = {}) {
  return Boolean(isMas && platform === 'darwin');
}

export function withSecurityScopedDialogOptions(options = {}, enabled = shouldUseSecurityScopedBookmarks()) {
  if (!enabled) {
    return { ...options };
  }

  return {
    ...options,
    securityScopedBookmarks: true,
  };
}

export function getSecurityScopedBookmark(dialogResult = {}) {
  if (typeof dialogResult?.bookmark === 'string' && dialogResult.bookmark) {
    return dialogResult.bookmark;
  }

  if (Array.isArray(dialogResult?.bookmarks) && typeof dialogResult.bookmarks[0] === 'string') {
    return dialogResult.bookmarks[0] || '';
  }

  return '';
}

export function hasDialogSelection(dialogResult = {}) {
  if (dialogResult?.canceled) {
    return false;
  }

  if (typeof dialogResult?.filePath === 'string') {
    return Boolean(dialogResult.filePath);
  }

  if (Array.isArray(dialogResult?.filePaths)) {
    return dialogResult.filePaths.some((filePath) => typeof filePath === 'string' && Boolean(filePath));
  }

  return false;
}

export async function withSecurityScopedAccess(electronApp, bookmark, run) {
  if (typeof run !== 'function') {
    return undefined;
  }

  const bookmarkValue = String(bookmark || '').trim();
  if (!bookmarkValue || typeof electronApp?.startAccessingSecurityScopedResource !== 'function') {
    return await run();
  }

  const stopAccess = electronApp.startAccessingSecurityScopedResource(bookmarkValue);
  try {
    return await run();
  } finally {
    if (typeof stopAccess === 'function') {
      stopAccess();
    }
  }
}

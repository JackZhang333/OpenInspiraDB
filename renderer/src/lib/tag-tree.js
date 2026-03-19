export function filterSidebarTagTree(tagTree = [], selectedTagIds = []) {
  const selectedSet = new Set((selectedTagIds || []).map((id) => Number(id)));

  return (tagTree || [])
    .map((group) => {
      const visibleChildren = (group.children || []).filter((tag) => (
        Number(tag.usageCount || 0) > 0 || selectedSet.has(Number(tag.id))
      ));

      if (!visibleChildren.length) {
        return null;
      }

      return {
        ...group,
        children: visibleChildren,
      };
    })
    .filter(Boolean);
}

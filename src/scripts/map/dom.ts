export const el = (tag: string, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const withSlot = (node: HTMLElement, slot: string) => {
  node.setAttribute('slot', slot);
  return node;
};

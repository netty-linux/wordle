import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

/**
 * Marca TipTap para cor por caractere/trecho (não altera `props.color` da shape inteira).
 */
export const TextColorExtension = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-text-color') ||
          element.style.color?.replace(/['"]+/g, '') ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return {
            'data-text-color': attributes.color,
            style: `color: ${attributes.color}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-text-color]' },
      { style: 'color', tag: 'span' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

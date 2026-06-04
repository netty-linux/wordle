import { Mark, mergeAttributes } from '@tiptap/core';

export interface TextFontAttributes {
  fontKey: string;
  fontFamily: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textFont: {
      setTextFont: (attrs: TextFontAttributes) => ReturnType;
      unsetTextFont: () => ReturnType;
    };
  }
}

/**
 * Marca TipTap para fonte por trecho (draw / sans / serif / mono).
 */
export const TextFontExtension = Mark.create({
  name: 'textFont',

  addAttributes() {
    return {
      fontKey: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-text-font'),
        renderHTML: (attributes) => {
          if (!attributes.fontKey) return {};
          return { 'data-text-font': attributes.fontKey };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: (element) =>
          element.style.fontFamily?.replace(/['"]+/g, '') || null,
        renderHTML: (attributes) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-text-font]' },
      { style: 'font-family', tag: 'span' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextFont:
        (attrs: TextFontAttributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetTextFont:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

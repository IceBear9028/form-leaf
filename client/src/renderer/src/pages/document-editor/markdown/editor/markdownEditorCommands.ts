import { Extension, InputRule, wrappingInputRule, markInputRule, textblockTypeInputRule, type Editor } from "@tiptap/core";
import type { MarkdownCommand } from "../commandTypes.ts";

export function executeMarkdownEditorCommand(editor: Editor, command: MarkdownCommand, range?: { from: number; to: number }): boolean {
  const chain = editor.isInitialized ? editor.chain().focus() : editor.chain();
  if (range) chain.deleteRange(range);
  switch (command.type) {
    case "inline-format": {
      const marks = { strong: "bold", emphasis: "italic", underline: "underline", delete: "strike", "inline-code": "code" };
      return chain.toggleMark(marks[command.format]).run();
    }
    case "heading": return chain.setHeading({ level: command.level }).run();
    case "paragraph": return chain.setParagraph().run();
    case "blockquote": return chain.toggleBlockquote().run();
    case "list": return command.style === "task" ? chain.toggleTaskList().run()
      : command.style === "ordered" ? chain.toggleOrderedList().run() : chain.toggleBulletList().run();
    case "code-block": return chain.toggleCodeBlock().run();
    case "divider": return chain.setHorizontalRule().run();
    case "clear-formatting": return chain.unsetAllMarks().clearNodes().run();
    case "link": {
      if (!command.href) return chain.unsetLink().run();
      if (editor.state.selection.empty) {
        return chain.insertContent({ type: "text", text: "링크", marks: [{ type: "link", attrs: { href: command.href } }] }).run();
      }
      return chain.setLink({ href: command.href }).run();
    }
  }
}

export const MarkdownAuthoring = Extension.create({
  name: "markdownAuthoring",
  priority: 1100,
  addInputRules() {
    return [
      textblockTypeInputRule({ find: /^```$/, type: this.editor.schema.nodes.codeBlock }),
      wrappingInputRule({ find: /^(\d+)\)\s$/, type: this.editor.schema.nodes.orderedList, getAttributes: (match) => ({ start: Number(match[1]) }) }),
      markInputRule({ find: /(?:^|\s)(\+\+([^+]+)\+\+)$/, type: this.editor.schema.marks.underline }),
      new InputRule({
        find: /^(#{1,6})\s$/,
        handler: ({ state, range, match }) => {
        if (this.editor.view.composing || state.selection.$from.parent.type.name === "codeBlock") return null;
        state.tr.delete(range.from, range.to).setBlockType(range.from, range.from, state.schema.nodes.heading, { level: match[1].length });
        },
      }),
    ];
  },
  addKeyboardShortcuts() {
    const run = (command: MarkdownCommand) => () => executeMarkdownEditorCommand(this.editor, command);
    return {
      "Mod-Shift-s": run({ type: "inline-format", format: "delete" }),
      "Mod-Shift-m": run({ type: "inline-format", format: "inline-code" }),
      "Mod-Shift-7": run({ type: "list", style: "ordered" }),
      "Mod-Shift-8": run({ type: "list", style: "unordered" }),
      "Mod-Shift-9": run({ type: "blockquote" }),
      "Mod-Shift--": run({ type: "divider" }),
      "Mod-\\": run({ type: "clear-formatting" }),
      "Mod-Shift-k": () => {
        const href = window.prompt("링크 URL", this.editor.getAttributes("link").href ?? "https://");
        return href === null ? true : executeMarkdownEditorCommand(this.editor, { type: "link", href });
      },
    };
  },
});

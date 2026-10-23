import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SHORTCUTS, useGlobalShortcuts } from "./useGlobalShortcuts";
import { ShortcutsModal } from "../components/ShortcutsModal";

type Group = { category: string; entries: Array<{ key: string; description: string }> };

function readmeGroups(): Group[] {
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const section = readme.split(/^## Keyboard shortcuts\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const groups: Group[] = [];
  let heading = "";
  for (const line of section.split(/\r?\n/)) {
    const title = line.match(/^#{3,4}\s+(.+?)\s*$/);
    if (title) {
      heading = title[1];
      continue;
    }
    const row = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/);
    if (!row) continue;
    if (groups.at(-1)?.category !== heading) groups.push({ category: heading, entries: [] });
    groups.at(-1)!.entries.push({ key: row[1], description: row[2] });
  }
  return groups;
}

function groupedShortcuts(): Group[] {
  const groups: Group[] = [];
  for (const { key, description, category } of SHORTCUTS) {
    let group = groups.find((g) => g.category === category);
    if (!group) groups.push((group = { category, entries: [] }));
    group.entries.push({ key, description });
  }
  return groups;
}

function modalGroups(): Group[] {
  render(<ShortcutsModal isOpen onClose={() => {}} />);
  return screen.getAllByRole("heading", { level: 3 }).map((heading) => ({
    category: heading.textContent ?? "",
    entries: Array.from(heading.nextElementSibling?.querySelectorAll("kbd") ?? []).map((kbd) => ({
      key: kbd.textContent ?? "",
      description: kbd.previousElementSibling?.textContent ?? "",
    })),
  }));
}

function Harness({ onKey }: { onKey: (event: KeyboardEvent) => void }) {
  useGlobalShortcuts(onKey);
  return (
    <div>
      <input aria-label="name" />
      <textarea aria-label="notes" />
      <select aria-label="plan">
        <option>Free</option>
      </select>
      <div aria-label="editor" contentEditable tabIndex={0} />
      <button type="button">plain</button>
    </div>
  );
}

describe("SHORTCUTS", () => {
  it("includes the g a sequence that App already handles", () => {
    expect(SHORTCUTS).toContainEqual({ key: "g a", description: "Go to My APIs", category: "Navigation" });
  });

  it("is listed in the README by category, exactly as the Shortcuts dialog shows it", () => {
    const dialog = modalGroups();
    expect(dialog).toEqual(groupedShortcuts());
    expect(readmeGroups()).toEqual(dialog);
  });
});

describe("useGlobalShortcuts", () => {
  it("passes key presses through when focus is outside form fields", () => {
    const onKey = vi.fn();
    render(<Harness onKey={onKey} />);
    screen.getByRole("button", { name: "plain" }).focus();
    fireEvent.keyDown(window, { key: "g" });
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it.each(["name", "notes", "plan"])("ignores key presses while the %s field has focus", (label) => {
    const onKey = vi.fn();
    render(<Harness onKey={onKey} />);
    screen.getByLabelText(label).focus();
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "?" });
    expect(onKey).not.toHaveBeenCalled();
  });

  it("ignores key presses while focus is in contenteditable content", () => {
    const onKey = vi.fn();
    render(<Harness onKey={onKey} />);
    const editor = screen.getByLabelText("editor");
    Object.defineProperty(editor, "isContentEditable", { value: true });
    editor.focus();
    expect(document.activeElement).toBe(editor);
    fireEvent.keyDown(window, { key: "g" });
    expect(onKey).not.toHaveBeenCalled();
  });
});

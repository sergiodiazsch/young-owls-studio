"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { Character, Prop } from "@/lib/types";

interface EntityFile {
  linkId: number;
  isPrimary: boolean;
  file: { id: number; filename: string; storagePath: string; mimeType: string };
}

interface MentionItem {
  id: number;
  name: string;
  description: string | null;
  type: "character" | "prop";
}

interface PromptWithMentionsProps {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  onCharacterSelected?: (character: Character, primaryImage: { storagePath: string; filename: string; preview: string } | null) => void;
  onPropSelected?: (prop: Prop, primaryImage: { storagePath: string; filename: string; preview: string } | null) => void;
}

export function PromptWithMentions({
  value,
  onChange,
  projectId,
  placeholder,
  rows = 5,
  className,
  onCharacterSelected,
  onPropSelected,
}: PromptWithMentionsProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load characters and props once
  useEffect(() => {
    fetch(`/api/characters?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data: Character[]) => setCharacters(data))
      .catch(() => {});
    fetch(`/api/props?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data: Prop[]) => setProps(data))
      .catch(() => {});
  }, [projectId]);

  // Combine into unified mention list
  const allMentions: MentionItem[] = [
    ...characters.map((c) => ({ id: c.id, name: c.name, description: c.description, type: "character" as const })),
    ...props.map((p) => ({ id: p.id, name: p.name, description: p.description, type: "prop" as const })),
  ];

  const filteredMentions = allMentions.filter((m) =>
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  const selectMention = useCallback(
    async (mention: MentionItem) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const before = value.slice(0, mentionStart);
      const after = value.slice(textarea.selectionStart);
      const tag = `@${mention.name}`;
      const newValue = before + tag + (after.startsWith(" ") ? "" : " ") + after;
      onChange(newValue);
      setShowDropdown(false);
      setFilter("");

      requestAnimationFrame(() => {
        const newPos = mentionStart + tag.length + (after.startsWith(" ") ? 0 : 1);
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      });

      // Fetch primary image and notify parent
      const filesUrl = mention.type === "character"
        ? `/api/characters/${mention.id}/files`
        : `/api/props/${mention.id}/files`;

      const callback = mention.type === "character" ? onCharacterSelected : onPropSelected;
      if (callback) {
        try {
          const res = await fetch(filesUrl);
          const files: EntityFile[] = await res.json();
          const primary = files.find((f) => f.isPrimary) ?? files[0];
          const entity = mention.type === "character"
            ? characters.find((c) => c.id === mention.id)
            : props.find((p) => p.id === mention.id);
          if (primary && entity) {
            (callback as (entity: Character | Prop, img: { storagePath: string; filename: string; preview: string } | null) => void)(entity, {
              storagePath: primary.file.storagePath,
              filename: primary.file.filename,
              preview: `/api/drive/files/${primary.file.id}`,
            });
          } else if (entity) {
            (callback as (entity: Character | Prop, img: null) => void)(entity, null);
          }
        } catch {
          const entity = mention.type === "character"
            ? characters.find((c) => c.id === mention.id)
            : props.find((p) => p.id === mention.id);
          if (entity) {
            (callback as (entity: Character | Prop, img: null) => void)(entity, null);
          }
        }
      }
    },
    [value, mentionStart, onChange, onCharacterSelected, onPropSelected, characters, props]
  );

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    const atMatch = textBeforeCursor.match(/(^|[^a-zA-Z0-9])@([a-zA-Z0-9 ]*)$/);

    if (atMatch && allMentions.length > 0) {
      const query = atMatch[2];
      setFilter(query);
      setMentionStart(cursorPos - query.length - 1);
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showDropdown || filteredMentions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredMentions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectMention(filteredMentions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll("[data-mention-item]");
    (items[selectedIndex] as HTMLElement)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, showDropdown]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />

      {showDropdown && filteredMentions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {filteredMentions.map((m, i) => (
            <button
              key={`${m.type}-${m.id}`}
              data-mention-item
              onClick={() => selectMention(m)}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                m.type === "character"
                  ? "bg-primary/10 text-primary"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              }`}>
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium truncate">{m.name}</span>
              <span className={`text-[10px] px-1.5 py-0 rounded-full shrink-0 ${
                m.type === "character"
                  ? "bg-primary/10 text-primary"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              }`}>
                {m.type === "character" ? "Character" : "Prop"}
              </span>
              {m.description && (
                <span className="text-xs text-muted-foreground truncate ml-auto">
                  {m.description}
                </span>
              )}
            </button>
          ))}
          <p className="text-[9px] text-muted-foreground px-3 py-1 border-t mt-1">
            Type @ to mention a character or prop. Their primary image will be added as reference.
          </p>
        </div>
      )}
    </div>
  );
}

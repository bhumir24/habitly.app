"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };

export function TimezoneCombobox({
  options,
  value,
  onSelect,
  id,
}: {
  options: Opt[];
  value: string;
  onSelect: (iana: string) => void;
  id?: string;
}) {
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? value ?? "UTC";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    );
  }, [options, query]);

  const pick = (iana: string, label: string) => {
    onSelect(iana);
    setQuery(label);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative z-30">
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-md border border-input bg-background shadow-sm ring-offset-background",
          open && "ring-2 ring-ring ring-offset-2"
        )}
      >
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-tz-list`}
          autoComplete="off"
          className="h-10 flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or choose timezone…"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle timezone list"
          className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent/50 rounded-r-md"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
        >
          <ChevronDown className={cn("h-4 w-4 opacity-60 transition", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <ul
          id={`${id}-tz-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(280px,50vh)] overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={cn(
                    "flex w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    o.value === value && "bg-accent/60"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o.value, o.label);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

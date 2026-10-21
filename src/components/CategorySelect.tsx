import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { mu } from "@/api/mu";
import { cx } from "@/components/ui";

/** Case/accent-insensitive "contains" for filtering. */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? norm(text).indexOf(norm(query)) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-brand/20 px-0.5 text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/**
 * Provider category — a searchable picker over the list the admin manages.
 * Type to filter, ↑/↓ + Enter or tap to choose, Esc to close, × to clear.
 */
export function CategorySelect({ value, onChange, required }: { value: string; onChange: (id: string) => void; required?: boolean }) {
  const cats = useQuery({ queryKey: ["categories"], queryFn: mu.categories, staleTime: 5 * 60_000 });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = cats.data?.find((c) => c.categoryId === value);
  const options = useMemo(() => (cats.data ?? []).filter((c) => !query || norm(c.name).includes(norm(query))), [cats.data, query]);

  // Close when tapping outside.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && close();
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  // Keep the highlighted option in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openPicker() {
    setOpen(true);
    setQuery("");
    setActive(Math.max(0, (cats.data ?? []).findIndex((c) => c.categoryId === value)));
  }
  function close() {
    setOpen(false);
    setQuery("");
  }
  function choose(categoryId: string) {
    onChange(categoryId);
    close();
    input.current?.blur();
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      return openPicker();
    }
    if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    else if (e.key === "Enter" && options[active]) (e.preventDefault(), choose(options[active].categoryId));
    else if (e.key === "Escape") close();
  }

  return (
    <div className="block" ref={wrap}>
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-medium text-muted">
        Category
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          <Search className="size-4" />
        </span>
        <input
          ref={input}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          required={required && !value}
          value={open ? query : selected?.name ?? ""}
          placeholder={cats.isLoading ? "Loading…" : selected ? selected.name : "Search categories"}
          onFocus={openPicker}
          onClick={() => !open && openPicker()}
          onChange={(e) => (setQuery(e.target.value), setActive(0), setOpen(true))}
          onKeyDown={onKey}
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-10 pr-20 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
          {value && !open && (
            <button type="button" aria-label="Clear category" onClick={() => onChange("")} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
              <X className="size-4" />
            </button>
          )}
          <button type="button" aria-label={open ? "Close categories" : "Show categories"} tabIndex={-1} onClick={() => (open ? close() : (openPicker(), input.current?.focus()))} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <ChevronDown className={cx("size-4 transition", open && "rotate-180")} />
          </button>
        </span>

        {open && (
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label="Categories"
            className="scrollbar-thin absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
          >
            {options.map((c, i) => (
              <li
                key={c.categoryId}
                id={`${id}-opt-${i}`}
                data-i={i}
                role="option"
                aria-selected={c.categoryId === value}
                onPointerDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => choose(c.categoryId)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[15px]",
                  i === active ? "bg-brand/10 text-ink" : "text-ink",
                  c.categoryId === value && "font-semibold",
                )}
              >
                <span className="truncate">
                  <Highlight text={c.name} query={query} />
                </span>
                {c.categoryId === value && <Check className="size-4 shrink-0 text-brand" />}
              </li>
            ))}
            {!options.length && (
              <li className="px-3 py-6 text-center text-sm text-muted">
                {cats.data?.length ? `No category matches “${query}”` : "No categories yet — an admin adds them"}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

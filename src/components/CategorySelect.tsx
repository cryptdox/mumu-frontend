import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { mu } from "@/api/mu";

/** Provider category, from the list the admin manages. */
export function CategorySelect({ value, onChange, required }: { value: string; onChange: (id: string) => void; required?: boolean }) {
  const cats = useQuery({ queryKey: ["categories"], queryFn: mu.categories, staleTime: 5 * 60_000 });
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">Category</span>
      <span className="relative block">
        <select
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full appearance-none rounded-2xl border border-line bg-surface px-4 pr-10 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
        >
          <option value="">{cats.isLoading ? "Loading…" : cats.data?.length ? "Choose a category" : "No categories yet"}</option>
          {cats.data?.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

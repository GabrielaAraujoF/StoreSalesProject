import Link from "next/link";

type MenuCardProps = {
  index: string;
  title: string;
  description: string;
  href: string;
  featured?: boolean;
};

export function MenuCard({
  index,
  title,
  description,
  href,
  featured = false,
}: MenuCardProps) {
  const surfaceClasses = featured
    ? "border-[#12322b] bg-[#12322b] text-white shadow-[0_18px_45px_-24px_rgba(18,50,43,0.8)] hover:bg-[#19463c]"
    : "border-slate-900/10 bg-white/85 text-[#12322b] shadow-[0_12px_35px_-28px_rgba(15,23,42,0.55)] hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)]";

  return (
    <Link
      href={href}
      className={`group flex min-h-52 flex-col justify-between rounded-2xl border p-6 transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 sm:min-h-56 ${surfaceClasses}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`text-xs font-bold tracking-[0.16em] ${
            featured ? "text-emerald-200" : "text-emerald-700"
          }`}
        >
          {index}
        </span>
        <span
          aria-hidden="true"
          className={`flex size-9 items-center justify-center rounded-full text-lg transition-transform duration-300 group-hover:translate-x-1 ${
            featured
              ? "bg-white/10 text-white"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          &rarr;
        </span>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-[-0.025em]">{title}</h2>
        <p
          className={`mt-2 text-sm leading-6 ${
            featured ? "text-emerald-50/75" : "text-slate-500"
          }`}
        >
          {description}
        </p>
      </div>
    </Link>
  );
}

import Link from "next/link";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f4f7f6] px-5 py-6 text-slate-950 sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-36 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between border-b border-slate-900/10 pb-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          aria-label={"Voltar para a p\u00e1gina inicial"}
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#12322b] text-lg font-bold text-white shadow-sm">
            S
          </span>
          <span>
            <span className="block text-lg font-bold tracking-[-0.03em] text-[#12322b]">
              StoreSales
            </span>
            <span className="block text-xs font-medium text-slate-500">
              Gestão comercial
            </span>
          </span>
        </Link>
      </header>

      <section className="relative mx-auto flex w-full max-w-6xl flex-1 items-center justify-center py-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-900/10 bg-white/90 p-7 text-center shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] sm:p-12">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-800">
            ...
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Em breve
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-[#12322b] sm:text-4xl">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
            {description}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#12322b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span aria-hidden="true">&larr;</span>
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}

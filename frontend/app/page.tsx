import { MenuCard } from "@/components/menu-card";

const menuItems = [
  {
    index: "01",
    title: "Produtos",
    description: "Consulte e organize o catálogo da sua loja.",
    href: "/produtos",
    featured: false,
  },
  {
    index: "02",
    title: "Clientes",
    description: "Acesse e acompanhe sua base de clientes.",
    href: "/clientes",
    featured: false,
  },
  {
    index: "03",
    title: "Nova venda",
    description: "Inicie um novo atendimento e registre uma venda.",
    href: "/nova-venda",
    featured: true,
  },
  {
    index: "04",
    title: "Histórico de vendas",
    description: "Consulte vendas realizadas e suas movimentações.",
    href: "/historico-vendas",
    featured: false,
  },
  {
    index: "05",
    title: "Dashboard",
    description: "Visualize indicadores e o desempenho do negócio.",
    href: "/dashboard",
    featured: false,
  },
] as const;

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7f6] text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-36 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 -left-36 h-[28rem] w-[28rem] rounded-full bg-sky-200/35 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-slate-900/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#12322b] text-lg font-bold text-white shadow-sm">
              S
            </div>
            <div>
              <p className="text-lg font-bold tracking-[-0.03em] text-[#12322b]">
                StoreSales
              </p>
              <p className="text-xs font-medium text-slate-500">
                Gestão comercial
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-900/10 bg-white/75 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm sm:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            Central de gestão
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16 lg:py-20">
          <div className="mb-9 max-w-2xl sm:mb-12">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Menu principal
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-[#102c27] sm:text-5xl lg:text-6xl">
              Sua operação,
              <span className="block text-emerald-700">simples e organizada.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Acesse rapidamente as principais áreas da StoreSales e mantenha
              seu negócio em movimento.
            </p>
          </div>

          <nav aria-label={"\u00c1reas principais do sistema"}>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
              {menuItems.map((item) => (
                <li
                  key={item.href}
                  className={
                    item.featured
                      ? "sm:col-span-2 lg:col-span-2"
                      : "lg:col-span-2"
                  }
                >
                  <MenuCard {...item} />
                </li>
              ))}
            </ul>
          </nav>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-900/10 pt-5 text-xs text-slate-500">
          <p>StoreSales</p>
          <p>Gestão simples para vender melhor.</p>
        </footer>
      </div>
    </main>
  );
}

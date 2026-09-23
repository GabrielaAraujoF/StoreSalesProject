"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  formatSaleCurrency,
  formatSaleDateTime,
  formatSaleSeller,
  getSalePaymentLabel,
  SaleDetailsModal,
} from "@/components/sales/sale-details-modal";
import { getDashboard } from "@/services/dashboard";
import { getSaleFilterSellers } from "@/services/sales";
import type {
  DashboardEvolutionPoint,
  DashboardResponse,
  Sale,
  SaleFilterSeller,
} from "@/types";

type PeriodPreset = "today" | "week" | "month" | "custom";

type DashboardFilterState = {
  preset: PeriodPreset;
  dateFrom: string;
  dateTo: string;
  seller: string;
};

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

const calendarDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function getBrazilToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BRAZIL_TIMEZONE,
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
  return `${values.year}-${values.month}-${values.day}`;
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toCalendarDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addCalendarDays(value: string, days: number) {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toCalendarDate(date);
}

function getPresetRange(preset: Exclude<PeriodPreset, "custom">) {
  const today = getBrazilToday();
  if (preset === "today") return { dateFrom: today, dateTo: today };

  if (preset === "week") {
    const weekday = parseCalendarDate(today).getUTCDay();
    const dateFrom = addCalendarDays(today, -(weekday === 0 ? 6 : weekday - 1));
    return { dateFrom, dateTo: addCalendarDays(dateFrom, 6) };
  }

  return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today };
}

function createInitialFilters(): DashboardFilterState {
  return { preset: "month", ...getPresetRange("month"), seller: "" };
}

function formatCalendarDate(value: string) {
  return calendarDateFormatter.format(parseCalendarDate(value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar os dados do dashboard.";
}

function SummaryCard({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
        featured
          ? "border-emerald-900/10 bg-[#12322b] text-white"
          : "border-slate-900/10 bg-white/90 text-[#12322b]"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.1em] ${
          featured ? "text-emerald-100/75" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
        {value}
      </p>
      <p className={`mt-1 text-xs ${featured ? "text-emerald-100/70" : "text-slate-500"}`}>
        {detail}
      </p>
    </article>
  );
}

function EvolutionChart({ points }: { points: DashboardEvolutionPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 760;
  const height = 280;
  const padding = { top: 24, right: 18, bottom: 48, left: 58 };
  const values = points.map((point) => Number(point.total));
  const maxValue = Math.max(...values, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    point,
    x:
      padding.left +
      (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: padding.top + chartHeight - (Number(point.total) / maxValue) * chartHeight,
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const activePoint = activeIndex === null ? null : points[activeIndex];

  return (
    <div>
      <div className="mb-3 flex min-h-10 flex-col justify-end sm:items-end">
        {activePoint ? (
          <p className="text-sm font-bold text-[#12322b]" aria-live="polite">
            {activePoint.label}: {formatSaleCurrency(activePoint.total)}
          </p>
        ) : (
          <p className="text-xs font-medium text-slate-500">
            Passe o mouse ou toque nos pontos para ver o valor exato.
          </p>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evolução do valor vendido no período"
        className="h-auto w-full overflow-visible"
        onPointerLeave={() => setActiveIndex(null)}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight * ratio;
          const value = maxValue * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#dbe5e1"
                strokeDasharray="4 6"
              />
              <text x={padding.left - 9} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
                {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : Math.round(value)}
              </text>
            </g>
          );
        })}
        {coordinates.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="#047857"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {coordinates.map(({ point, x, y }, index) => (
          <g key={point.key}>
            <circle
              cx={x}
              cy={y}
              r={activeIndex === index ? 7 : 5}
              fill={activeIndex === index ? "#12322b" : "#10b981"}
              stroke="white"
              strokeWidth="3"
              className="cursor-pointer outline-none focus:stroke-[#12322b]"
              tabIndex={0}
              role="button"
              aria-label={`${point.label}: ${formatSaleCurrency(point.total)}`}
              onPointerEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
            >
              <title>{`${point.label}: ${formatSaleCurrency(point.total)}`}</title>
            </circle>
            {(index % labelStep === 0 || index === coordinates.length - 1) && (
              <text
                x={x}
                y={height - 18}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] font-semibold"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function PaymentChart({ data }: { data: DashboardResponse["payments"] }) {
  const colors: Record<string, string> = {
    cash: "bg-emerald-700",
    credit_card: "bg-sky-600",
    debit_card: "bg-amber-500",
    pix: "bg-violet-600",
  };

  return (
    <ul className="space-y-5">
      {data.map((payment) => (
        <li key={payment.method}>
          <button
            type="button"
            title={`${payment.label}: ${formatSaleCurrency(payment.total)} (${payment.percentage.toLocaleString("pt-BR")}%)`}
            className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
          >
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-700">{payment.label}</span>
              <span className="text-right font-bold text-[#12322b]">
                {formatSaleCurrency(payment.total)}
              </span>
            </span>
            <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className={`block h-full rounded-full ${colors[payment.method] ?? "bg-emerald-700"}`}
                style={{
                  width: `${payment.total === "0.00" ? 0 : Math.max(payment.percentage, 2)}%`,
                }}
              />
            </span>
            <span className="mt-1.5 flex justify-between text-xs text-slate-500">
              <span>{payment.sales_count} vendas</span>
              <span>{payment.percentage.toLocaleString("pt-BR")}%</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Carregando dashboard" aria-live="polite" className="mt-6 space-y-5">
      <span className="sr-only">Carregando indicadores...</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl bg-white/75" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-96 animate-pulse rounded-3xl bg-white/75 lg:col-span-2" />
        <div className="h-96 animate-pulse rounded-3xl bg-white/75" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [draftFilters, setDraftFilters] = useState<DashboardFilterState>(() =>
    createInitialFilters(),
  );
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilterState>(() =>
    createInitialFilters(),
  );
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [sellers, setSellers] = useState<SaleFilterSeller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const requestSequenceRef = useRef(0);
  const sellerListId = useId();

  const historyHref = useMemo(() => {
    const params = new URLSearchParams({
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
    });
    if (appliedFilters.seller.trim()) {
      params.set("seller", appliedFilters.seller.trim());
    }
    return `/historico-vendas?${params.toString()}`;
  }, [appliedFilters]);

  useEffect(() => {
    const controller = new AbortController();
    getSaleFilterSellers(controller.signal)
      .then(setSellers)
      .catch(() => {
        if (!controller.signal.aborted) setSellers([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestSequenceRef.current;

    getDashboard(
      {
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        seller: appliedFilters.seller,
      },
      controller.signal,
    )
      .then((response) => {
        if (requestId === requestSequenceRef.current && !controller.signal.aborted) {
          setDashboard(response);
        }
      })
      .catch((error: unknown) => {
        if (requestId === requestSequenceRef.current && !controller.signal.aborted) {
          setLoadError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (requestId === requestSequenceRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [appliedFilters, retryToken]);

  function selectPreset(preset: PeriodPreset) {
    setFilterError(null);
    if (preset === "custom") {
      setDraftFilters((current) => ({ ...current, preset }));
      return;
    }
    setDraftFilters((current) => ({
      ...current,
      preset,
      ...getPresetRange(preset),
    }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedFilters: DashboardFilterState = {
      ...draftFilters,
      dateFrom: String(formData.get("date_from") ?? draftFilters.dateFrom),
      dateTo: String(formData.get("date_to") ?? draftFilters.dateTo),
      seller: String(formData.get("seller") ?? draftFilters.seller),
    };

    if (!submittedFilters.dateFrom || !submittedFilters.dateTo) {
      setFilterError("Informe a data inicial e a data final.");
      return;
    }
    if (submittedFilters.dateFrom > submittedFilters.dateTo) {
      setFilterError("A data inicial não pode ser posterior à data final.");
      return;
    }

    setFilterError(null);
    setLoadError(null);
    setIsLoading(true);
    setDraftFilters(submittedFilters);
    setAppliedFilters(submittedFilters);
  }

  function retryLoad() {
    setLoadError(null);
    setIsLoading(true);
    setRetryToken((value) => value + 1);
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#f4f7f6] text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-36 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 -left-36 h-[28rem] w-[28rem] rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-slate-900/10 pb-6">
          <Link href="/" aria-label="Voltar para a página inicial" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#12322b] text-lg font-bold text-white shadow-sm">S</span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-[-0.03em] text-[#12322b]">StoreSales</span>
              <span className="block text-xs font-medium text-slate-500">Gestão comercial</span>
            </span>
          </Link>
          <Link href="/nova-venda" className="shrink-0 rounded-xl bg-[#12322b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30">
            Nova venda
          </Link>
        </header>

        <section className="flex-1 py-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Desempenho</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#102c27] sm:text-5xl">Dashboard</h1>

          <form onSubmit={applyFilters} className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.5)] sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-lg font-bold text-[#12322b]">Filtros</h2>
                <p className="mt-1 text-sm text-slate-500">Período e vendedor.</p>
              </div>
              <p className="text-xs font-bold text-emerald-800">
                {formatCalendarDate(appliedFilters.dateFrom)} a {formatCalendarDate(appliedFilters.dateTo)}
              </p>
            </div>

            <fieldset className="mt-5">
              <legend className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Período</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {([
                  ["today", "Hoje"],
                  ["week", "Esta semana"],
                  ["month", "Este mês"],
                  ["custom", "Período personalizado"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={draftFilters.preset === value}
                    onClick={() => selectPreset(value)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 ${
                      draftFilters.preset === value
                        ? "border-[#12322b] bg-[#12322b] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-800/30 hover:text-emerald-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
              {draftFilters.preset === "custom" && (
                <>
                  <label className="block lg:col-span-3">
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Data inicial</span>
                    <input
                      type="date"
                      name="date_from"
                      required
                      value={draftFilters.dateFrom}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </label>
                  <label className="block lg:col-span-3">
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Data final</span>
                    <input
                      type="date"
                      name="date_to"
                      required
                      value={draftFilters.dateTo}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </label>
                </>
              )}

              <label className={`block ${draftFilters.preset === "custom" ? "lg:col-span-4" : "lg:col-span-6"}`}>
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Vendedor</span>
                <div className="relative mt-2">
                  <input
                    type="search"
                    name="seller"
                    list={sellerListId}
                    value={draftFilters.seller}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, seller: event.target.value }))}
                    placeholder="Todos os vendedores"
                    autoComplete="off"
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-20 text-sm font-semibold text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                  />
                  {draftFilters.seller && (
                    <button type="button" onClick={() => setDraftFilters((current) => ({ ...current, seller: "" }))} className="absolute inset-y-1.5 right-1.5 rounded-lg px-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50">
                      Todos
                    </button>
                  )}
                </div>
                <datalist id={sellerListId}>
                  {sellers.flatMap((seller) => [
                    <option key={`${seller.id}-number`} value={String(seller.seller_number)} label={`${seller.name}${seller.active ? "" : " · Inativo"}`} />,
                    <option key={`${seller.id}-name`} value={seller.name} label={`Nº ${seller.seller_number}${seller.active ? "" : " · Inativo"}`} />,
                  ])}
                </datalist>
                <span className="mt-1.5 block text-xs text-slate-500">Nome ou número, incluindo vendedores inativos.</span>
              </label>

              <div className={`flex items-end ${draftFilters.preset === "custom" ? "lg:col-span-2" : "lg:col-span-6"}`}>
                <button type="submit" className="min-h-11 w-full rounded-xl bg-[#12322b] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30">
                  Aplicar filtros
                </button>
              </div>
            </div>
            {filterError && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{filterError}</p>}
          </form>

          {loadError ? (
            <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800">
              <p className="font-semibold">{loadError}</p>
              <button type="button" onClick={retryLoad} className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 font-bold transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200">
                Tentar novamente
              </button>
            </div>
          ) : isLoading || !dashboard ? (
            <DashboardSkeleton />
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard label="Total vendido" value={formatSaleCurrency(dashboard.summary.total_amount)} detail="Faturamento no período" featured />
                <SummaryCard label="Quantidade de vendas" value={dashboard.summary.sales_count.toLocaleString("pt-BR")} detail="Vendas concluídas" />
                <SummaryCard label="Ticket médio" value={formatSaleCurrency(dashboard.summary.average_ticket)} detail="Média por venda" />
                <SummaryCard label="Unidades vendidas" value={dashboard.summary.units_sold.toLocaleString("pt-BR")} detail="Itens comercializados" />
              </div>

              {dashboard.summary.sales_count === 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
                  Nenhuma venda encontrada para os filtros selecionados.
                </div>
              )}

              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <section className="rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-sm sm:p-6 lg:col-span-2" aria-labelledby="evolution-title">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Vendas no tempo</p>
                    <h2 id="evolution-title" className="mt-1 text-xl font-bold text-[#12322b]">Evolução das vendas</h2>
                  </div>
                  <EvolutionChart points={dashboard.evolution.points} />
                </section>

                <section className="rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-sm sm:p-6" aria-labelledby="payment-title">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Distribuição</p>
                  <h2 id="payment-title" className="mt-1 text-xl font-bold text-[#12322b]">Métodos de pagamento</h2>
                  <div className="mt-6"><PaymentChart data={dashboard.payments} /></div>
                </section>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <section className="overflow-hidden rounded-3xl border border-slate-900/10 bg-white/90 shadow-sm" aria-labelledby="products-ranking-title">
                  <header className="border-b border-slate-100 px-5 py-5 sm:px-6">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Ranking</p>
                    <h2 id="products-ranking-title" className="mt-1 text-xl font-bold text-[#12322b]">Produtos mais vendidos</h2>
                  </header>
                  {dashboard.top_products.length ? (
                    <ol className="divide-y divide-slate-100">
                      {dashboard.top_products.map((product, index) => (
                        <li key={product.product_id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-bold text-slate-800">{product.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{product.units_sold} unidades</p>
                          </div>
                          <p className="shrink-0 text-right font-bold text-[#12322b]">{formatSaleCurrency(product.total_amount)}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">Sem produtos vendidos no período.</p>
                  )}
                </section>

                <section className="overflow-hidden rounded-3xl border border-slate-900/10 bg-white/90 shadow-sm" aria-labelledby="sellers-ranking-title">
                  <header className="border-b border-slate-100 px-5 py-5 sm:px-6">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Ranking</p>
                    <h2 id="sellers-ranking-title" className="mt-1 text-xl font-bold text-[#12322b]">Desempenho dos vendedores</h2>
                  </header>
                  {dashboard.seller_performance.length ? (
                    <ol className="divide-y divide-slate-100">
                      {dashboard.seller_performance.map((seller, index) => (
                        <li key={seller.seller_id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-bold text-sky-800">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words font-bold text-slate-800">{seller.name}</p>
                              {!seller.active && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-amber-700">Inativo</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">Nº {seller.seller_number} · {seller.sales_count} vendas</p>
                          </div>
                          <p className="shrink-0 text-right font-bold text-[#12322b]">{formatSaleCurrency(seller.total_amount)}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">Sem desempenho para exibir.</p>
                  )}
                </section>
              </div>

              <section className="mt-5 overflow-hidden rounded-3xl border border-slate-900/10 bg-white/90 shadow-sm" aria-labelledby="recent-sales-title">
                <header className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Movimentações</p>
                    <h2 id="recent-sales-title" className="mt-1 text-xl font-bold text-[#12322b]">Vendas recentes</h2>
                  </div>
                  <Link href={historyHref} className="rounded-xl border border-emerald-900/15 bg-white px-4 py-2.5 text-center text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20">
                    Ver histórico completo
                  </Link>
                </header>

                {dashboard.recent_sales.length ? (
                  <>
                    <div className="hidden md:block">
                      <table className="w-full table-fixed border-collapse text-left">
                        <thead className="bg-slate-50/90 text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="w-[10%] px-6 py-3.5 font-bold">Venda</th>
                            <th className="w-[20%] px-3 py-3.5 font-bold">Data e hora</th>
                            <th className="w-[25%] px-3 py-3.5 font-bold">Vendedor</th>
                            <th className="w-[17%] px-3 py-3.5 font-bold">Pagamento</th>
                            <th className="w-[15%] px-3 py-3.5 text-right font-bold">Total</th>
                            <th className="w-[13%] px-6 py-3.5 text-right font-bold">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dashboard.recent_sales.map((sale) => (
                            <tr key={sale.id} className="transition hover:bg-emerald-50/35">
                              <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-800">#{sale.id}</td>
                              <td className="px-3 py-4 text-sm font-medium text-slate-600">{formatSaleDateTime(sale.created_at)}</td>
                              <td className="px-3 py-4 text-sm font-semibold text-slate-700"><span className="block break-words">{formatSaleSeller(sale.seller)}</span></td>
                              <td className="px-3 py-4 text-sm text-slate-600">{getSalePaymentLabel(sale.payment_method)}</td>
                              <td className="px-3 py-4 text-right font-bold text-[#12322b]">{formatSaleCurrency(sale.total)}</td>
                              <td className="px-6 py-4 text-right">
                                <button type="button" onClick={() => setSelectedSale(sale)} className="rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20">Detalhes</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="divide-y divide-slate-100 md:hidden">
                      {dashboard.recent_sales.map((sale) => (
                        <li key={sale.id} className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-mono text-sm font-bold text-emerald-800">Venda #{sale.id}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatSaleDateTime(sale.created_at)}</p>
                            </div>
                            <p className="shrink-0 font-bold text-[#12322b]">{formatSaleCurrency(sale.total)}</p>
                          </div>
                          <p className="mt-3 break-words text-sm font-semibold text-slate-700">{formatSaleSeller(sale.seller)}</p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-500">{getSalePaymentLabel(sale.payment_method)}</span>
                            <button type="button" onClick={() => setSelectedSale(sale)} className="rounded-lg border border-emerald-900/15 px-3 py-2 text-xs font-bold text-emerald-800">Ver detalhes</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma venda recente no período.</p>
                )}
              </section>
            </>
          )}
        </section>

        <footer className="flex items-center justify-between gap-4 border-t border-slate-900/10 pt-5 text-xs text-slate-500">
          <p>StoreSales</p>
          <p className="text-right">Gestão simples para vender melhor.</p>
        </footer>
      </div>

      {selectedSale && <SaleDetailsModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    </main>
  );
}

"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useState } from "react";

import { SaleDetailsModal } from "@/components/sales/sale-details-modal";
import { getSaleFilterSellers, getSales } from "@/services/sales";
import type {
  PaymentMethod,
  Sale,
  SaleFilterSeller,
  SaleListResponse,
} from "@/types";

type PeriodType = "day" | "week" | "month" | "custom";

export type SalesHistoryInitialQuery = {
  dateFrom?: string;
  dateTo?: string;
  seller?: string;
};

type HistoryFilters = {
  period: PeriodType;
  day: string;
  weekDate: string;
  month: string;
  customFrom: string;
  customTo: string;
  seller: string;
  paymentMethod: PaymentMethod | "";
};

const PAGE_SIZE = 10;
const BRAZIL_TIMEZONE = "America/Sao_Paulo";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: BRAZIL_TIMEZONE,
});

const calendarDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
};

const emptyResult: SaleListResponse = {
  sales: [],
  pagination: { page: 1, per_page: PAGE_SIZE, total: 0, total_pages: 0 },
  summary: { sales_count: 0, total_amount: "0.00" },
};

function getBrazilDateParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BRAZIL_TIMEZONE,
  }).formatToParts(new Date());

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
}

function isCalendarDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function createInitialFilters(
  initialQuery: SalesHistoryInitialQuery = {},
): HistoryFilters {
  const today = getBrazilDateParts();
  const date = `${today.year}-${today.month}-${today.day}`;
  const filters: HistoryFilters = {
    period: "month",
    day: date,
    weekDate: date,
    month: `${today.year}-${today.month}`,
    customFrom: date,
    customTo: date,
    seller: initialQuery.seller?.trim() ?? "",
    paymentMethod: "",
  };

  if (
    isCalendarDate(initialQuery.dateFrom) &&
    isCalendarDate(initialQuery.dateTo) &&
    initialQuery.dateFrom <= initialQuery.dateTo
  ) {
    filters.customFrom = initialQuery.dateFrom;
    filters.customTo = initialQuery.dateTo;
    if (initialQuery.dateFrom === initialQuery.dateTo) {
      filters.period = "day";
      filters.day = initialQuery.dateFrom;
    } else {
      filters.period = "custom";
    }
  }

  return filters;
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatCalendarDate(value: string) {
  return calendarDateFormatter.format(parseCalendarDate(value));
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

function getWeekRange(value: string) {
  const weekday = parseCalendarDate(value).getUTCDay();
  const dateFrom = addCalendarDays(value, -(weekday === 0 ? 6 : weekday - 1));
  return { dateFrom, dateTo: addCalendarDays(dateFrom, 6) };
}

function getMonthRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  return {
    dateFrom: `${value}-01`,
    dateTo: toCalendarDate(new Date(Date.UTC(year, month, 0))),
  };
}

function getDateRange(filters: HistoryFilters) {
  if (filters.period === "day" && filters.day) {
    return { dateFrom: filters.day, dateTo: filters.day };
  }
  if (filters.period === "week" && filters.weekDate) {
    return getWeekRange(filters.weekDate);
  }
  if (filters.period === "month" && filters.month) {
    return getMonthRange(filters.month);
  }
  if (filters.period === "custom" && filters.customFrom && filters.customTo) {
    return { dateFrom: filters.customFrom, dateTo: filters.customTo };
  }
  return null;
}

function formatCurrency(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? currencyFormatter.format(numericValue)
    : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

function formatSeller(seller: Sale["seller"]) {
  return seller
    ? `${seller.name} · Nº ${seller.seller_number}`
    : "Vendedor não informado";
}

function getPaymentLabel(paymentMethod: string) {
  const normalizedMethod = paymentMethod === "card" ? "credit_card" : paymentMethod;
  return paymentLabels[normalizedMethod as PaymentMethod] ?? paymentMethod;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar o histórico de vendas.";
}

function ResultSkeleton() {
  return (
    <div aria-label="Carregando vendas" aria-live="polite" className="space-y-3">
      <span className="sr-only">Carregando vendas...</span>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-2xl border border-slate-900/5 bg-white/75"
        />
      ))}
    </div>
  );
}

export function SalesHistoryPage({
  initialQuery = {},
}: {
  initialQuery?: SalesHistoryInitialQuery;
}) {
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(() =>
    createInitialFilters(initialQuery),
  );
  const [appliedFilters, setAppliedFilters] = useState<HistoryFilters>(() =>
    createInitialFilters(initialQuery),
  );
  const [result, setResult] = useState<SaleListResponse>(emptyResult);
  const [sellers, setSellers] = useState<SaleFilterSeller[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const sellerListId = useId();

  const draftRange = getDateRange(draftFilters);
  const appliedRange = getDateRange(appliedFilters);

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
    const range = getDateRange(appliedFilters);
    if (!range) return () => controller.abort();

    getSales(
      {
        page,
        perPage: PAGE_SIZE,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        seller: appliedFilters.seller,
        paymentMethod: appliedFilters.paymentMethod,
      },
      controller.signal,
    )
      .then(setResult)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [appliedFilters, page, retryToken]);

  function updateFilter<Key extends keyof HistoryFilters>(key: Key, value: HistoryFilters[Key]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedFilters: HistoryFilters = {
      ...draftFilters,
      period: String(formData.get("period") ?? draftFilters.period) as PeriodType,
      day: String(formData.get("day") ?? draftFilters.day),
      weekDate: String(formData.get("week_date") ?? draftFilters.weekDate),
      month: String(formData.get("month") ?? draftFilters.month),
      customFrom: String(formData.get("date_from") ?? draftFilters.customFrom),
      customTo: String(formData.get("date_to") ?? draftFilters.customTo),
      seller: String(formData.get("seller") ?? draftFilters.seller),
      paymentMethod: String(
        formData.get("payment_method") ?? draftFilters.paymentMethod,
      ) as PaymentMethod | "",
    };

    if (!getDateRange(submittedFilters)) {
      setFilterError("Selecione uma data válida para o período informado.");
      return;
    }
    if (
      submittedFilters.period === "custom" &&
      submittedFilters.customFrom > submittedFilters.customTo
    ) {
      setFilterError("A data inicial não pode ser posterior à data final.");
      return;
    }
    setFilterError(null);
    setIsLoading(true);
    setLoadError(null);
    setPage(1);
    setDraftFilters(submittedFilters);
    setAppliedFilters(submittedFilters);
  }

  function clearFilters() {
    const resetFilters = createInitialFilters();
    setFilterError(null);
    setIsLoading(true);
    setLoadError(null);
    setDraftFilters(resetFilters);
    setAppliedFilters(resetFilters);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setIsLoading(true);
    setLoadError(null);
    setPage(nextPage);
  }

  function retryLoad() {
    setIsLoading(true);
    setLoadError(null);
    setRetryToken((value) => value + 1);
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#f4f7f6] text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-36 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 -left-36 h-[28rem] w-[28rem] rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 border-b border-slate-900/10 pb-6">
          <Link
            href="/"
            aria-label="Voltar para a página inicial"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#12322b] text-lg font-bold text-white shadow-sm">S</span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-[-0.03em] text-[#12322b]">StoreSales</span>
              <span className="block text-xs font-medium text-slate-500">Gestão comercial</span>
            </span>
          </Link>
          <Link
            href="/nova-venda"
            className="shrink-0 rounded-xl bg-[#12322b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            Nova venda
          </Link>
        </header>

        <section className="flex-1 py-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Movimentações</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#102c27] sm:text-5xl">Histórico de vendas</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Encontre vendas por período, vendedor e pagamento e consulte os valores registrados em cada operação.
          </p>

          <form
            onSubmit={applyFilters}
            className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.5)] sm:p-6"
          >
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-lg font-bold text-[#12322b]">Filtros</h2>
                <p className="mt-1 text-sm text-slate-500">Combine os campos para refinar a pesquisa.</p>
              </div>
              {appliedRange && (
                <p className="text-xs font-bold text-emerald-800">
                  Período atual: {formatCalendarDate(appliedRange.dateFrom)} a {formatCalendarDate(appliedRange.dateTo)}
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <label className="block lg:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Período</span>
                <select
                  name="period"
                  value={draftFilters.period}
                  onChange={(event) => updateFilter("period", event.target.value as PeriodType)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                >
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                  <option value="month">Mês</option>
                  <option value="custom">Período personalizado</option>
                </select>
              </label>

              <div className="block lg:col-span-3">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                  {draftFilters.period === "day"
                    ? "Data"
                    : draftFilters.period === "week"
                      ? "Data dentro da semana"
                      : draftFilters.period === "month"
                        ? "Mês e ano"
                        : "Intervalo personalizado"}
                </span>
                {draftFilters.period === "day" && (
                  <input
                    type="date"
                    name="day"
                    aria-label="Data da venda"
                    required
                    value={draftFilters.day}
                    onChange={(event) => updateFilter("day", event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                  />
                )}
                {draftFilters.period === "week" && (
                  <input
                    type="date"
                    name="week_date"
                    aria-label="Data dentro da semana"
                    required
                    value={draftFilters.weekDate}
                    onChange={(event) => updateFilter("weekDate", event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                  />
                )}
                {draftFilters.period === "month" && (
                  <input
                    type="month"
                    name="month"
                    aria-label="Mês e ano"
                    required
                    value={draftFilters.month}
                    onChange={(event) => updateFilter("month", event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                  />
                )}
                {draftFilters.period === "week" && draftRange && (
                  <span className="mt-1.5 block text-xs font-semibold text-emerald-700">
                    Segunda, {formatCalendarDate(draftRange.dateFrom)} a domingo, {formatCalendarDate(draftRange.dateTo)}
                  </span>
                )}
                {draftFilters.period === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      name="date_from"
                      required
                      aria-label="Data inicial"
                      value={draftFilters.customFrom}
                      onChange={(event) => updateFilter("customFrom", event.target.value)}
                      className="min-h-11 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                    />
                    <input
                      type="date"
                      name="date_to"
                      required
                      aria-label="Data final"
                      value={draftFilters.customTo}
                      onChange={(event) => updateFilter("customTo", event.target.value)}
                      className="min-h-11 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </div>
                )}
              </div>

              <label className="block lg:col-span-4">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Vendedor</span>
                <div className="relative mt-2">
                  <input
                    type="search"
                    name="seller"
                    list={sellerListId}
                    value={draftFilters.seller}
                    onChange={(event) => updateFilter("seller", event.target.value)}
                    placeholder="Todos os vendedores"
                    autoComplete="off"
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-20 text-sm font-semibold text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                  />
                  {draftFilters.seller && (
                    <button
                      type="button"
                      onClick={() => updateFilter("seller", "")}
                      className="absolute inset-y-1.5 right-1.5 rounded-lg px-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50"
                    >
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
                <span className="mt-1.5 block text-xs text-slate-500">
                  Busque pelo nome ou número; vendedores inativos também aparecem.
                </span>
              </label>

              <label className="block lg:col-span-3">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Método de pagamento</span>
                <select
                  name="payment_method"
                  value={draftFilters.paymentMethod}
                  onChange={(event) => updateFilter("paymentMethod", event.target.value as PaymentMethod | "")}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                >
                  <option value="">Todos</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de crédito</option>
                  <option value="debit_card">Cartão de débito</option>
                  <option value="pix">Pix</option>
                </select>
              </label>
            </div>

            {filterError && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{filterError}</p>}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
              >
                Limpar filtros
              </button>
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-[#12322b] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
              >
                Filtrar
              </button>
            </div>
          </form>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-900/10 bg-[#12322b] p-5 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-100/75">Vendas no resultado</p>
              <p className="mt-2 text-3xl font-bold">{isLoading ? "—" : result.summary.sales_count.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs text-emerald-100/70">Considera todas as páginas</p>
            </div>
            <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/90 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800/70">Total vendido</p>
              <p className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#12322b]">
                {isLoading ? "—" : formatCurrency(result.summary.total_amount)}
              </p>
              <p className="mt-1 text-xs text-emerald-800/60">Conforme todos os filtros ativos</p>
            </div>
          </div>

          <section className="mt-6" aria-labelledby="sales-result-title">
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 id="sales-result-title" className="text-xl font-bold text-[#12322b]">Vendas encontradas</h2>
                <p className="mt-1 text-sm text-slate-500">Da mais recente para a mais antiga.</p>
              </div>
              {!isLoading && !loadError && result.pagination.total > 0 && (
                <p className="text-xs font-semibold text-slate-500">
                  Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.pagination.total)} de {result.pagination.total}
                </p>
              )}
            </div>

            {loadError ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center text-sm text-red-800">
                <p className="font-semibold">{loadError}</p>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 font-bold transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                >
                  Tentar novamente
                </button>
              </div>
            ) : isLoading ? (
              <ResultSkeleton />
            ) : result.sales.length === 0 ? (
              <div className="rounded-2xl border border-slate-900/10 bg-white/90 px-5 py-12 text-center">
                <p className="text-lg font-bold text-[#12322b]">Nenhuma venda corresponde aos filtros</p>
                <p className="mt-2 text-sm text-slate-500">Ajuste o período ou remova algum filtro para ampliar a busca.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-xl border border-emerald-900/15 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
                >
                  Voltar ao mês atual
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white/90 shadow-sm">
                <div className="hidden lg:block">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead className="bg-slate-50/90 text-xs uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="w-[8%] px-5 py-3.5 font-bold">Venda</th>
                        <th className="w-[16%] px-3 py-3.5 font-bold">Data e hora</th>
                        <th className="w-[18%] px-3 py-3.5 font-bold">Cliente</th>
                        <th className="w-[20%] px-3 py-3.5 font-bold">Vendedor</th>
                        <th className="w-[14%] px-3 py-3.5 font-bold">Pagamento</th>
                        <th className="w-[12%] px-3 py-3.5 text-right font-bold">Total</th>
                        <th className="w-[12%] px-5 py-3.5 text-right font-bold">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.sales.map((sale) => (
                        <tr key={sale.id} className="transition hover:bg-emerald-50/35">
                          <td className="px-5 py-4 align-middle font-mono text-sm font-bold text-emerald-800">#{sale.id}</td>
                          <td className="px-3 py-4 align-middle text-sm font-medium text-slate-600">{formatDateTime(sale.created_at)}</td>
                          <td className="px-3 py-4 align-middle text-sm font-semibold text-slate-700">
                            <span className="block break-words">{sale.customer?.name ?? "Cliente não informado"}</span>
                          </td>
                          <td className="px-3 py-4 align-middle text-sm font-semibold text-slate-700">
                            <span className="block break-words">{formatSeller(sale.seller)}</span>
                          </td>
                          <td className="px-3 py-4 align-middle text-sm text-slate-600">{getPaymentLabel(sale.payment_method)}</td>
                          <td className="px-3 py-4 text-right align-middle font-bold text-[#12322b]">{formatCurrency(sale.total)}</td>
                          <td className="px-5 py-4 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => setSelectedSale(sale)}
                              className="rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-700/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
                            >
                              Ver detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-slate-100 lg:hidden">
                  {result.sales.map((sale) => (
                    <li key={sale.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-sm font-bold text-emerald-800">Venda #{sale.id}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">{formatDateTime(sale.created_at)}</p>
                        </div>
                        <p className="shrink-0 text-lg font-bold text-[#12322b]">{formatCurrency(sale.total)}</p>
                      </div>
                      <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Cliente</dt>
                          <dd className="mt-1 break-words font-semibold text-slate-700">{sale.customer?.name ?? "Cliente não informado"}</dd>
                        </div>
                        <div>
                          <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Vendedor</dt>
                          <dd className="mt-1 break-words font-semibold text-slate-700">{formatSeller(sale.seller)}</dd>
                        </div>
                        <div>
                          <dt className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">Pagamento</dt>
                          <dd className="mt-1 font-semibold text-slate-700">{getPaymentLabel(sale.payment_method)}</dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        onClick={() => setSelectedSale(sale)}
                        className="mt-4 min-h-10 w-full rounded-xl border border-emerald-900/15 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
                      >
                        Ver detalhes
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isLoading && !loadError && result.pagination.total_pages > 1 && (
              <nav aria-label="Paginação do histórico de vendas" className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-900/10 bg-white/75 p-3 sm:flex-row">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => changePage(Math.max(1, page - 1))}
                  className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  ← Anterior
                </button>
                <p className="text-sm font-semibold text-slate-600">
                  Página <span className="font-bold text-[#12322b]">{page}</span> de <span className="font-bold text-[#12322b]">{result.pagination.total_pages}</span>
                </p>
                <button
                  type="button"
                  disabled={page >= result.pagination.total_pages}
                  onClick={() =>
                    changePage(Math.min(result.pagination.total_pages, page + 1))
                  }
                  className="min-h-10 w-full rounded-xl bg-[#12322b] px-4 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  Próxima →
                </button>
              </nav>
            )}
          </section>
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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSales } from "@/services/sales";
import type { Sale } from "@/types";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "PIX",
};

function formatCurrency(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? currencyFormatter.format(numericValue)
    : value;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar o histórico de vendas.";
}

export function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function retryLoadSales() {
    setIsLoading(true);
    setLoadError(null);

    try {
      setSales(await getSales());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    getSales(controller.signal)
      .then(setSales)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7f6] text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-36 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-slate-900/10 pb-6">
          <Link
            href="/"
            aria-label="Voltar para a página inicial"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
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
          <Link
            href="/nova-venda"
            className="rounded-xl bg-[#12322b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            Nova venda
          </Link>
        </header>

        <section className="flex-1 py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Movimentações
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[#102c27] sm:text-5xl">
            Histórico de vendas
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Consulte os vendedores, clientes, produtos e valores registrados.
          </p>

          {loadError && (
            <div
              role="alert"
              className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
            >
              <span className="font-medium">{loadError}</span>
              <button
                type="button"
                onClick={() => void retryLoadSales()}
                className="font-bold underline underline-offset-4"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-10 text-center text-sm font-medium text-slate-500">
              Carregando vendas...
            </div>
          ) : !loadError && sales.length === 0 ? (
            <div className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-10 text-center">
              <p className="text-lg font-bold text-[#12322b]">
                Nenhuma venda registrada
              </p>
              <p className="mt-2 text-sm text-slate-500">
                As vendas finalizadas aparecerão aqui.
              </p>
            </div>
          ) : (
            <ul className="mt-7 space-y-4">
              {sales.map((sale) => (
                <li
                  key={sale.id}
                  className="rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.5)] sm:p-7"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                        Venda #{sale.id}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        {formatDate(sale.created_at)}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-[#12322b]">
                      {formatCurrency(sale.total)}
                    </p>
                  </div>

                  <dl className="grid gap-4 py-5 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        Vendedor
                      </dt>
                      <dd className="mt-1 font-bold text-slate-700">
                        {sale.seller
                          ? `${sale.seller.name} · Nº ${sale.seller.seller_number}`
                          : "Não informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        Cliente
                      </dt>
                      <dd className="mt-1 font-bold text-slate-700">
                        {sale.customer?.name ?? "Sem cliente"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        Pagamento
                      </dt>
                      <dd className="mt-1 font-bold text-slate-700">
                        {paymentLabels[sale.payment_method] ?? sale.payment_method}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      Produtos
                    </p>
                    <ul className="mt-2 divide-y divide-slate-200">
                      {sale.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {item.quantity} × {item.product_name}
                          </span>
                          <span className="font-bold text-slate-700">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

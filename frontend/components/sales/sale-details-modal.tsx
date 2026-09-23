"use client";

import { useEffect } from "react";

import type { PaymentMethod, Sale } from "@/types";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
};

export function formatSaleCurrency(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? currencyFormatter.format(numericValue)
    : value;
}

export function formatSaleDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function getSalePaymentLabel(paymentMethod: string) {
  const normalizedMethod = paymentMethod === "card" ? "credit_card" : paymentMethod;
  return paymentLabels[normalizedMethod as PaymentMethod] ?? paymentMethod;
}

export function formatSaleSeller(seller: Sale["seller"]) {
  return seller
    ? `${seller.name} · Nº ${seller.seller_number}`
    : "Vendedor não informado";
}

export function SaleDetailsModal({
  sale,
  onClose,
}: {
  sale: Sale;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-details-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/20 bg-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Venda #{sale.id}
            </p>
            <h2
              id="sale-details-title"
              className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
            >
              Detalhes da venda
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatSaleDateTime(sale.created_at)}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Fechar detalhes da venda"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                Cliente
              </dt>
              <dd className="mt-1 font-bold text-slate-700">
                {sale.customer?.name ?? "Cliente não informado"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                Vendedor
              </dt>
              <dd className="mt-1 font-bold text-slate-700">
                {formatSaleSeller(sale.seller)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                Pagamento
              </dt>
              <dd className="mt-1 font-bold text-slate-700">
                {getSalePaymentLabel(sale.payment_method)}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <h3 className="font-bold text-[#12322b]">Produtos vendidos</h3>
              <span className="text-right text-xs font-medium text-slate-500">
                Valores registrados na venda
              </span>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {sale.items.map((item) => (
                <li key={item.id} className="p-4 sm:px-5">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_8rem_8rem] sm:items-center">
                    <p className="min-w-0 break-words font-bold text-slate-800">
                      {item.product_name}
                    </p>
                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400 sm:hidden">
                        Quantidade
                      </p>
                      <p className="text-sm font-medium text-slate-600 sm:text-center">
                        {item.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400 sm:hidden">
                        Preço unitário
                      </p>
                      <p className="text-sm font-medium text-slate-600 sm:text-right">
                        {formatSaleCurrency(item.unit_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400 sm:hidden">
                        Subtotal
                      </p>
                      <p className="font-bold text-[#12322b] sm:text-right">
                        {formatSaleCurrency(item.subtotal)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-5 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
          <span className="text-sm font-bold text-slate-500">Total da venda</span>
          <span className="text-2xl font-bold text-[#12322b]">
            {formatSaleCurrency(sale.total)}
          </span>
        </footer>
      </section>
    </div>
  );
}

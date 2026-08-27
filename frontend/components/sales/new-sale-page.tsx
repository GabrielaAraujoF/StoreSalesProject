

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { getCustomers } from "@/services/customers";
import { getProducts } from "@/services/products";
import { createSale } from "@/services/sales";
import { getSellerByNumber } from "@/services/sellers";
import type {
  Customer,
  PaymentMethod,
  Product,
  SaleInput,
  Seller,
} from "@/types";

type CartItem = {
  productId: number;
  productName: string;
  productCategory: string;
  availableStock: number;
  quantity: string;
  unitPriceInCents: number;
};

type QuantityControlProps = {
  item: CartItem;
  disabled: boolean;
  onDecrease: (productId: number) => void;
  onIncrease: (productId: number) => void;
  onChange: (productId: number, value: string) => void;
};

const PAYMENT_OPTIONS: ReadonlyArray<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Dinheiro" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "pix", label: "PIX" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(valueInCents: number) {
  return currencyFormatter.format(valueInCents / 100);
}

function priceToCents(price: string) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice) ? Math.round(numericPrice * 100) : 0;
}

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function digitsOnly(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getQuantityError(item: CartItem) {
  const quantity = Number(item.quantity);

  if (!item.quantity || !Number.isInteger(quantity) || quantity <= 0) {
    return "Informe uma quantidade inteira maior que zero.";
  }

  if (quantity > item.availableStock) {
    return `Estoque insuficiente. Há ${item.availableStock} ${item.availableStock === 1 ? "unidade disponível" : "unidades disponíveis"}.`;
  }

  return null;
}

function fieldClasses() {
  return "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
}

function QuantityControl({
  item,
  disabled,
  onDecrease,
  onIncrease,
  onChange,
}: QuantityControlProps) {
  const quantity = Number(item.quantity);
  const quantityError = getQuantityError(item);

  return (
    <div>
      <div className="flex w-fit items-center rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => onDecrease(item.productId)}
          disabled={disabled || !Number.isInteger(quantity) || quantity <= 1}
          aria-label={`Diminuir quantidade de ${item.productName}`}
          className="flex size-9 items-center justify-center rounded-l-xl text-lg font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-35"
        >
          &minus;
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={item.quantity}
          onChange={(event) => onChange(item.productId, event.target.value)}
          onBlur={() => {
            if (!item.quantity) {
              onChange(item.productId, "1");
            }
          }}
          disabled={disabled}
          aria-label={`Quantidade de ${item.productName}`}
          aria-invalid={Boolean(quantityError)}
          aria-describedby={
            quantityError ? `quantity-error-${item.productId}` : undefined
          }
          className={`h-9 w-10 border-x bg-white text-center text-sm font-bold outline-none focus:ring-4 ${
            quantityError
              ? "border-red-300 text-red-700 focus:ring-red-100"
              : "border-slate-200 text-slate-800 focus:ring-emerald-100"
          }`}
        />
        <button
          type="button"
          onClick={() => onIncrease(item.productId)}
          disabled={
            disabled ||
            !Number.isInteger(quantity) ||
            quantity >= item.availableStock
          }
          aria-label={`Aumentar quantidade de ${item.productName}`}
          className="flex size-9 items-center justify-center rounded-r-xl text-lg font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-35"
        >
          +
        </button>
      </div>
      {quantityError && (
        <p
          id={`quantity-error-${item.productId}`}
          className="mt-1.5 max-w-40 text-xs font-medium leading-4 text-red-600"
        >
          {quantityError}
        </p>
      )}
    </div>
  );
}

function RemoveButton({
  item,
  disabled,
  onRemove,
}: {
  item: CartItem;
  disabled: boolean;
  onRemove: (productId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onRemove(item.productId)}
      disabled={disabled}
      aria-label={`Remover ${item.productName} da venda`}
      title="Remover produto"
      className="flex size-9 items-center justify-center rounded-xl border border-red-200 bg-white text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden="true">&#10005;</span>
    </button>
  );
}

export function NewSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [sellerNumber, setSellerNumber] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerLookupError, setSellerLookupError] = useState<string | null>(null);
  const [isLoadingSeller, setIsLoadingSeller] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancelConfirmationButtonRef = useRef<HTMLButtonElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const productSearchContainerRef = useRef<HTMLDivElement>(null);
  const customerSearchContainerRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);

  useEffect(() => {
    function closeSearchResults(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!productSearchContainerRef.current?.contains(event.target)) {
        setIsProductSearchOpen(false);
      }

      if (!customerSearchContainerRef.current?.contains(event.target)) {
        setIsCustomerSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeSearchResults);
    return () => document.removeEventListener("pointerdown", closeSearchResults);
  }, []);

  useEffect(() => {
    const normalizedSellerNumber = sellerNumber.trim();

    if (!normalizedSellerNumber) {
      return;
    }

    const numericSellerNumber = Number(normalizedSellerNumber);
    if (
      !Number.isInteger(numericSellerNumber) ||
      numericSellerNumber <= 0
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoadingSeller(true);
      setSelectedSeller(null);
      setSellerLookupError(null);

      try {
        const seller = await getSellerByNumber(
          numericSellerNumber,
          controller.signal,
        );

        if (!seller) {
          setSellerLookupError("Vendedor não encontrado.");
        } else if (!seller.active) {
          setSellerLookupError("Vendedor inativo.");
        } else {
          setSelectedSeller(seller);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSellerLookupError(
          getErrorMessage(error, "Não foi possível localizar o vendedor."),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSeller(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sellerNumber]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductLoadError(null);

      try {
        setProducts(await getProducts(controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setProductLoadError(
          getErrorMessage(error, "Não foi possível carregar os produtos."),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingProducts(false);
        }
      }
    }

    async function loadCustomers() {
      setIsLoadingCustomers(true);
      setCustomerLoadError(null);

      try {
        setCustomers(await getCustomers(controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCustomerLoadError(
          getErrorMessage(
            error,
            "Não foi possível carregar os clientes. A venda ainda pode ser feita sem cliente.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCustomers(false);
        }
      }
    }

    void loadProducts();
    void loadCustomers();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isConfirmationOpen) {
      return;
    }

    cancelConfirmationButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submissionLockRef.current) {
        setIsConfirmationOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isConfirmationOpen]);

  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === Number(customerId)) ?? null,
    [customerId, customers],
  );

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim();

    if (!term) {
      return customers.slice(0, 6);
    }

    const textTerm = searchable(term);
    const phoneTerm = digitsOnly(term);

    return customers
      .filter(
        (customer) =>
          searchable(customer.name).includes(textTerm) ||
          (phoneTerm.length > 0 &&
            digitsOnly(customer.phone).includes(phoneTerm)),
      )
      .slice(0, 6);
  }, [customerSearch, customers]);

  const filteredProducts = useMemo(() => {
    const term = searchable(productSearch.trim());

    if (!term) {
      return [];
    }

    return products
      .filter((product) =>
        searchable(`${product.name} ${product.category}`).includes(term),
      )
      .slice(0, 8);
  }, [productSearch, products]);

  const totalInCents = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const quantity = Number(item.quantity);
        return Number.isInteger(quantity) && quantity > 0
          ? total + item.unitPriceInCents * quantity
          : total;
      }, 0),
    [cartItems],
  );

  const totalUnits = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const quantity = Number(item.quantity);
        return Number.isInteger(quantity) && quantity > 0
          ? total + quantity
          : total;
      }, 0),
    [cartItems],
  );

  const hasInvalidItem = cartItems.some((item) =>
    Boolean(getQuantityError(item)),
  );
  const canFinalize =
    cartItems.length > 0 &&
    selectedSeller !== null &&
    paymentMethod !== "" &&
    !hasInvalidItem &&
    !isSubmitting;
  const selectedPayment =
    PAYMENT_OPTIONS.find((option) => option.value === paymentMethod) ?? null;

  async function refreshCustomers() {
    setIsLoadingCustomers(true);
    setCustomerLoadError(null);

    try {
      setCustomers(await getCustomers());
    } catch (error) {
      setCustomerLoadError(
        getErrorMessage(
          error,
          "Não foi possível carregar os clientes. A venda ainda pode ser feita sem cliente.",
        ),
      );
    } finally {
      setIsLoadingCustomers(false);
    }
  }

  async function refreshProducts() {
    setIsLoadingProducts(true);
    setProductLoadError(null);

    try {
      const refreshedProducts = await getProducts();
      setProducts(refreshedProducts);
      setCartItems((currentItems) =>
        currentItems.map((item) => {
          const refreshedProduct = refreshedProducts.find(
            (product) => product.id === item.productId,
          );

          return refreshedProduct
            ? {
                ...item,
                productName: refreshedProduct.name,
                productCategory: refreshedProduct.category,
                availableStock: refreshedProduct.stock,
                unitPriceInCents: priceToCents(refreshedProduct.price),
              }
            : { ...item, availableStock: 0 };
        }),
      );
    } catch (error) {
      setProductLoadError(
        getErrorMessage(error, "Não foi possível atualizar os estoques."),
      );
    } finally {
      setIsLoadingProducts(false);
    }
  }

  function selectCustomer(customer: Customer) {
    setCustomerId(String(customer.id));
    setCustomerSearch(customer.name);
    setIsCustomerSearchOpen(false);
    setSubmitError(null);
  }

  function clearCustomer() {
    setCustomerId("");
    setCustomerSearch("");
    setIsCustomerSearchOpen(false);
    setSubmitError(null);
    requestAnimationFrame(() => customerSearchInputRef.current?.focus());
  }

  function addProduct(product: Product) {
    setSuccessMessage(null);
    setSubmitError(null);
    setSelectionError(null);

    if (product.stock <= 0) {
      setSelectionError("Este produto está sem estoque e não pode ser adicionado.");
      return;
    }

    const existingItem = cartItems.find(
      (item) => item.productId === product.id,
    );

    if (existingItem) {
      const currentQuantity = Number(existingItem.quantity);

      if (
        Number.isInteger(currentQuantity) &&
        currentQuantity >= existingItem.availableStock
      ) {
        setSelectionError(
          `Todo o estoque disponível de ${product.name} já está na venda.`,
        );
        return;
      }

      setCartItems((current) =>
        current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: String(Number(item.quantity) + 1) }
            : item,
        ),
      );
    } else {
      setCartItems((current) => [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          productCategory: product.category,
          availableStock: product.stock,
          quantity: "1",
          unitPriceInCents: priceToCents(product.price),
        },
      ]);
    }

    setProductSearch("");
    setIsProductSearchOpen(false);
    requestAnimationFrame(() => productSearchInputRef.current?.focus());
  }

  function updateItemQuantity(productId: number, value: string) {
    if (!/^\d*$/.test(value)) {
      return;
    }

    setSuccessMessage(null);
    setSubmitError(null);
    setCartItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        if (value === "") {
          return { ...item, quantity: value };
        }

        if (item.availableStock <= 0) {
          return item;
        }

        const requestedQuantity = Number(value);
        const safeQuantity = Math.min(
          Math.max(requestedQuantity, 1),
          item.availableStock,
        );

        return { ...item, quantity: String(safeQuantity) };
      }),
    );
  }

  function increaseItemQuantity(productId: number) {
    setCartItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const currentQuantity = Number(item.quantity);
        const nextQuantity =
          Number.isInteger(currentQuantity) && currentQuantity > 0
            ? currentQuantity + 1
            : 1;

        return nextQuantity <= item.availableStock
          ? { ...item, quantity: String(nextQuantity) }
          : item;
      }),
    );
    setSuccessMessage(null);
    setSubmitError(null);
  }

  function decreaseItemQuantity(productId: number) {
    setCartItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) {
          return item;
        }

        const currentQuantity = Number(item.quantity);
        return {
          ...item,
          quantity: String(
            Number.isInteger(currentQuantity) && currentQuantity > 1
              ? currentQuantity - 1
              : 1,
          ),
        };
      }),
    );
    setSuccessMessage(null);
    setSubmitError(null);
  }

  function removeItem(productId: number) {
    setCartItems((current) =>
      current.filter((item) => item.productId !== productId),
    );
    setSuccessMessage(null);
    setSubmitError(null);
  }

  function openConfirmation() {
    if (!canFinalize) {
      return;
    }

    setSubmitError(null);
    setIsConfirmationOpen(true);
  }

  async function finalizeSale() {
    if (submissionLockRef.current || !canFinalize || !selectedSeller) {
      return;
    }

    const payload: SaleInput = {
      customer_id: customerId ? Number(customerId) : null,
      seller_id: selectedSeller.id,
      payment_method: paymentMethod,
      items: cartItems.map((item) => ({
        product_id: item.productId,
        quantity: Number(item.quantity),
      })),
    };

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const completedSale = await createSale(payload);

      setCartItems([]);
      setCustomerId("");
      setCustomerSearch("");
      setSellerNumber("");
      setSelectedSeller(null);
      setSellerLookupError(null);
      setPaymentMethod("");
      setProductSearch("");
      setSelectionError(null);
      setIsConfirmationOpen(false);
      setSuccessMessage(
        `Venda #${completedSale.id} finalizada com sucesso. Total: ${formatCurrency(priceToCents(completedSale.total))}.`,
      );
      await refreshProducts();
    } catch (error) {
      const isStockConflict = error instanceof ApiError && error.status === 409;

      if (isStockConflict) {
        await refreshProducts();
      }

      setIsConfirmationOpen(false);
      setSubmitError(
        isStockConflict
          ? `${getErrorMessage(error, "O estoque disponível mudou.")} Os estoques foram atualizados; revise as quantidades antes de tentar novamente.`
          : getErrorMessage(
              error,
              "Não foi possível registrar a venda. Tente novamente.",
            ),
      );
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }

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

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
        <header className="flex items-center justify-between border-b border-slate-900/10 pb-5">
          <Link
            href="/"
            aria-label="Voltar para a página inicial"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#12322b] text-base font-bold text-white shadow-sm">
              S
            </span>
            <span>
              <span className="block text-base font-bold tracking-[-0.03em] text-[#12322b] sm:text-lg">
                StoreSales
              </span>
              <span className="hidden text-xs font-medium text-slate-500 sm:block">
                Gestão comercial
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/75 px-3.5 py-2 text-sm font-bold text-[#12322b] shadow-sm transition hover:border-emerald-700/30 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span aria-hidden="true">&larr;</span>
            <span className="hidden sm:inline">Voltar ao início</span>
            <span className="sm:hidden">Início</span>
          </Link>
        </header>

        <section className="flex-1 py-7 sm:py-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                Atendimento
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[#102c27] sm:text-4xl">
                Nova venda
              </h1>
            </div>
            <span className="hidden rounded-full border border-emerald-900/10 bg-white/80 px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm sm:block">
              {cartItems.length} {cartItems.length === 1 ? "produto" : "produtos"}
            </span>
          </div>

          {successMessage && (
            <div
              role="status"
              className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
              >
                &#10003;
              </span>
              <span className="pt-0.5">{successMessage}</span>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
              >
                !
              </span>
              <span className="pt-0.5">{submitError}</span>
            </div>
          )}

          <section
            aria-label="Identificação da venda"
            className="mt-5 grid gap-4 rounded-2xl border border-slate-900/10 bg-white/80 p-4 shadow-[0_16px_45px_-36px_rgba(15,23,42,0.45)] md:grid-cols-2"
          >
            <div ref={customerSearchContainerRef} className="relative min-w-0">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="customer-search"
                  className="text-sm font-bold text-slate-700"
                >
                  Cliente <span className="font-medium text-slate-400">(opcional)</span>
                </label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={clearCustomer}
                    disabled={isSubmitting}
                    className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:opacity-50"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="relative mt-2">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  &#9906;
                </span>
                <input
                  ref={customerSearchInputRef}
                  id="customer-search"
                  type="search"
                  value={customerSearch}
                  onFocus={() => setIsCustomerSearchOpen(true)}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    setCustomerId("");
                    setIsCustomerSearchOpen(true);
                    setSubmitError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsCustomerSearchOpen(false);
                    }

                    if (event.key === "Enter" && filteredCustomers[0]) {
                      event.preventDefault();
                      selectCustomer(filteredCustomers[0]);
                    }
                  }}
                  disabled={isLoadingCustomers || isSubmitting}
                  placeholder={
                    isLoadingCustomers
                      ? "Carregando clientes..."
                      : "Buscar cliente por nome ou telefone..."
                  }
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={isCustomerSearchOpen}
                  aria-controls="customer-results"
                  className={`${fieldClasses()} pl-10 pr-10`}
                />
                {selectedCustomer && (
                  <span
                    aria-label="Cliente selecionado"
                    title="Cliente selecionado"
                    className="pointer-events-none absolute right-3.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white"
                  >
                    &#10003;
                  </span>
                )}
              </div>

              {isCustomerSearchOpen && (
                <div
                  id="customer-results"
                  className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                >
                  {filteredCustomers.length > 0 ? (
                    <ul className="max-h-64 overflow-y-auto p-1.5">
                      {filteredCustomers.map((customer) => (
                        <li key={customer.id}>
                          <button
                            type="button"
                            onClick={() => selectCustomer(customer)}
                            className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-slate-800">
                                {customer.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {customer.phone ?? "Sem telefone cadastrado"}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-bold text-emerald-700">
                              Selecionar
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-slate-500">
                      Nenhum cliente encontrado.
                    </p>
                  )}
                </div>
              )}

              {selectedCustomer && (
                <p className="mt-1.5 truncate text-xs font-medium text-emerald-800">
                  {selectedCustomer.name}
                  {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
                </p>
              )}
              {customerLoadError && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <p className="font-medium text-amber-700">{customerLoadError}</p>
                  <button
                    type="button"
                    onClick={() => void refreshCustomers()}
                    disabled={isLoadingCustomers}
                    className="font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <label
                htmlFor="sale-seller"
                className="text-sm font-bold text-slate-700"
              >
                Número do vendedor <span className="text-red-600">*</span>
              </label>
              <input
                id="sale-seller"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={sellerNumber}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*$/.test(value)) {
                    setSellerNumber(value);
                    setSelectedSeller(null);
                    setSellerLookupError(
                      value && Number(value) <= 0
                        ? "Informe um número de vendedor válido."
                        : null,
                    );
                    setIsLoadingSeller(false);
                    setSubmitError(null);
                  }
                }}
                disabled={isSubmitting}
                placeholder="Ex.: 102"
                aria-invalid={Boolean(sellerLookupError)}
                aria-describedby="sale-seller-feedback"
                className={`${fieldClasses()} mt-2`}
              />
              <p
                id="sale-seller-feedback"
                className={`mt-1.5 text-xs font-medium ${
                  sellerLookupError
                    ? "text-red-600"
                    : selectedSeller
                      ? "text-emerald-800"
                      : "text-slate-500"
                }`}
              >
                {isLoadingSeller
                  ? "Localizando vendedor..."
                  : sellerLookupError
                    ? sellerLookupError
                    : selectedSeller
                      ? `Vendedor: ${selectedSeller.name}`
                      : "Informe o número para identificar o vendedor."}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="sale-items-title"
            className="mt-5 rounded-3xl border border-slate-900/10 bg-white/90 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)]"
          >
            <div className="border-b border-slate-900/10 p-4 sm:p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                    Venda atual
                  </p>
                  <h2
                    id="sale-items-title"
                    className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#12322b] sm:text-2xl"
                  >
                    Itens da venda
                  </h2>
                </div>
                {!isLoadingProducts && !productLoadError && (
                  <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:block">
                    {products.filter((product) => product.stock > 0).length} disponíveis
                  </span>
                )}
              </div>

              {productLoadError ? (
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-red-800">
                    {productLoadError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refreshProducts()}
                    disabled={isLoadingProducts}
                    className="min-h-10 shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingProducts ? "Atualizando..." : "Tentar novamente"}
                  </button>
                </div>
              ) : (
                <div ref={productSearchContainerRef} className="relative mt-4">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-lg text-slate-400"
                  >
                    &#9906;
                  </span>
                  <input
                    ref={productSearchInputRef}
                    id="product-search"
                    type="search"
                    value={productSearch}
                    onFocus={() => setIsProductSearchOpen(true)}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setIsProductSearchOpen(true);
                      setSelectionError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setIsProductSearchOpen(false);
                      }

                      if (event.key === "Enter" && filteredProducts[0]) {
                        event.preventDefault();
                        addProduct(filteredProducts[0]);
                      }
                    }}
                    disabled={isLoadingProducts || isSubmitting}
                    placeholder={
                      isLoadingProducts
                        ? "Carregando produtos..."
                        : "Buscar produto por nome ou categoria..."
                    }
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={
                      isProductSearchOpen && productSearch.trim().length > 0
                    }
                    aria-controls="product-results"
                    className="h-13 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  {isProductSearchOpen && productSearch.trim().length > 0 && (
                    <div
                      id="product-results"
                      className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                    >
                      {filteredProducts.length > 0 ? (
                        <ul className="max-h-80 overflow-y-auto p-1.5">
                          {filteredProducts.map((product) => {
                            const cartItem = cartItems.find(
                              (item) => item.productId === product.id,
                            );
                            const cartQuantity = Number(cartItem?.quantity ?? 0);
                            const isAtStockLimit =
                              Boolean(cartItem) && cartQuantity >= product.stock;
                            const isUnavailable = product.stock <= 0 || isAtStockLimit;

                            return (
                              <li key={product.id}>
                                <button
                                  type="button"
                                  onClick={() => addProduct(product)}
                                  disabled={isUnavailable || isSubmitting}
                                  className="grid w-full min-w-0 gap-2 rounded-xl px-3 py-3 text-left transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-slate-800">
                                      {product.name}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                                      {product.category}
                                    </span>
                                  </span>
                                  <span className="text-sm font-bold text-[#12322b]">
                                    {formatCurrency(priceToCents(product.price))}
                                  </span>
                                  <span
                                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                                      product.stock > 0
                                        ? "bg-emerald-50 text-emerald-800"
                                        : "bg-red-50 text-red-700"
                                    }`}
                                  >
                                    {product.stock > 0
                                      ? isAtStockLimit
                                        ? "Limite no carrinho"
                                        : `Estoque: ${product.stock}`
                                      : "Sem estoque"}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="px-4 py-3 text-sm text-slate-500">
                          Nenhum produto encontrado.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectionError && (
                <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                  {selectionError}
                </p>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="px-5 py-10 text-center sm:px-7">
                <span
                  aria-hidden="true"
                  className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-bold text-emerald-700"
                >
                  +
                </span>
                <h3 className="mt-3 font-bold text-[#12322b]">
                  Nenhum produto adicionado
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Pesquise acima para iniciar a venda.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full table-fixed border-collapse text-left">
                    <colgroup>
                      <col />
                      <col className="w-32 lg:w-36" />
                      <col className="w-28 lg:w-32" />
                      <col className="w-28 lg:w-32" />
                      <col className="w-14 lg:w-16" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        <th scope="col" className="px-4 py-3 lg:px-6">
                          Produto
                        </th>
                        <th scope="col" className="px-2 py-3">
                          Quantidade
                        </th>
                        <th scope="col" className="px-2 py-3">
                          Unitário
                        </th>
                        <th scope="col" className="px-2 py-3">
                          Subtotal
                        </th>
                        <th scope="col" className="px-2 py-3 text-center">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cartItems.map((item) => {
                        const quantity = Number(item.quantity);
                        const validQuantity =
                          Number.isInteger(quantity) && quantity > 0
                            ? quantity
                            : 0;

                        return (
                          <tr key={item.productId} className="align-middle">
                            <td className="min-w-0 px-4 py-4 lg:px-6">
                              <p className="truncate text-sm font-bold text-slate-800">
                                {item.productName}
                              </p>
                              <p
                                className={`mt-0.5 truncate text-xs font-medium ${
                                  item.availableStock > 0
                                    ? "text-slate-500"
                                    : "text-red-600"
                                }`}
                              >
                                {item.productCategory} · Estoque: {item.availableStock}
                              </p>
                            </td>
                            <td className="px-2 py-4">
                              <QuantityControl
                                item={item}
                                disabled={isSubmitting}
                                onDecrease={decreaseItemQuantity}
                                onIncrease={increaseItemQuantity}
                                onChange={updateItemQuantity}
                              />
                            </td>
                            <td className="whitespace-nowrap px-2 py-4 text-sm font-semibold text-slate-600">
                              {formatCurrency(item.unitPriceInCents)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-4 text-sm font-bold text-[#12322b]">
                              {formatCurrency(
                                item.unitPriceInCents * validQuantity,
                              )}
                            </td>
                            <td className="px-2 py-4">
                              <div className="flex justify-center">
                                <RemoveButton
                                  item={item}
                                  disabled={isSubmitting}
                                  onRemove={removeItem}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-slate-100 md:hidden">
                  {cartItems.map((item) => {
                    const quantity = Number(item.quantity);
                    const validQuantity =
                      Number.isInteger(quantity) && quantity > 0 ? quantity : 0;

                    return (
                      <li key={item.productId} className="p-4">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-800">
                              {item.productName}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {item.productCategory} · Estoque: {item.availableStock}
                            </p>
                          </div>
                          <RemoveButton
                            item={item}
                            disabled={isSubmitting}
                            onRemove={removeItem}
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                          <div>
                            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                              Quantidade
                            </p>
                            <QuantityControl
                              item={item}
                              disabled={isSubmitting}
                              onDecrease={decreaseItemQuantity}
                              onIncrease={increaseItemQuantity}
                              onChange={updateItemQuantity}
                            />
                          </div>
                          <dl className="grid grid-cols-2 gap-x-5 text-right">
                            <div>
                              <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                                Unitário
                              </dt>
                              <dd className="mt-1 whitespace-nowrap text-sm font-semibold text-slate-600">
                                {formatCurrency(item.unitPriceInCents)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                                Subtotal
                              </dt>
                              <dd className="mt-1 whitespace-nowrap text-sm font-bold text-[#12322b]">
                                {formatCurrency(
                                  item.unitPriceInCents * validQuantity,
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <div className="border-t border-slate-900/10 p-4 sm:p-5 lg:p-6">
              <fieldset>
                <legend className="text-sm font-bold text-slate-700">
                  Forma de pagamento <span className="text-red-600">*</span>
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PAYMENT_OPTIONS.map((option) => {
                    const isSelected = paymentMethod === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(option.value);
                          setSubmitError(null);
                        }}
                        disabled={isSubmitting}
                        aria-pressed={isSelected}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSelected
                            ? "border-[#12322b] bg-[#12322b] text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-700/30 hover:bg-emerald-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="grid gap-5 rounded-b-3xl bg-[#12322b] p-5 text-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
              <div className="flex min-w-0 flex-wrap items-end justify-between gap-5 sm:justify-start sm:gap-10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200/70">
                    Venda
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-50/80">
                    {cartItems.length} {cartItems.length === 1 ? "produto" : "produtos"} · {totalUnits} {totalUnits === 1 ? "unidade" : "unidades"}
                  </p>
                </div>
                <div className="text-right sm:text-left">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200/70">
                    Total
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
                    {formatCurrency(totalInCents)}
                  </p>
                </div>
              </div>

              <div className="sm:w-64">
                <button
                  type="button"
                  onClick={openConfirmation}
                  disabled={!canFinalize}
                  aria-describedby={!canFinalize ? "finalize-help" : undefined}
                  className="min-h-12 w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#102c27] shadow-[0_12px_30px_-18px_rgba(52,211,153,0.8)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/40 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/45 disabled:shadow-none"
                >
                  {isSubmitting ? "Finalizando..." : "Finalizar venda"}
                </button>
                {!canFinalize && (
                  <p
                    id="finalize-help"
                    className="mt-2 text-center text-xs leading-4 text-emerald-100/65"
                  >
                    {cartItems.length === 0
                      ? "Adicione ao menos um produto."
                      : !selectedSeller
                        ? "Informe um vendedor válido."
                      : hasInvalidItem
                        ? "Revise as quantidades e o estoque."
                        : paymentMethod === ""
                          ? "Selecione a forma de pagamento."
                          : "Aguarde a operação atual."}
                  </p>
                )}
              </div>
            </div>
          </section>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-900/10 pt-5 text-xs text-slate-500">
          <p>StoreSales</p>
          <p>Gestão simples para vender melhor.</p>
        </footer>
      </div>

      {isConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-5">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-sale-title"
            aria-describedby="confirm-sale-description"
            className="my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
          >
            <div className="p-5 sm:p-7">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-700">
                &#10003;
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Confirmação
              </p>
              <h2
                id="confirm-sale-title"
                className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
              >
                Confirmar venda?
              </h2>
              <p
                id="confirm-sale-description"
                className="mt-1 text-sm text-slate-500"
              >
                Confira os dados antes de finalizar.
              </p>

              <dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Cliente
                  </dt>
                  <dd className="mt-1 font-bold text-slate-700">
                    {selectedCustomer?.name ?? "Sem cliente identificado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Vendedor
                  </dt>
                  <dd className="mt-1 font-bold text-slate-700">
                    {selectedSeller?.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Pagamento
                  </dt>
                  <dd className="mt-1 font-bold text-slate-700">
                    {selectedPayment?.label}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Itens
                  </dt>
                  <dd className="mt-1 font-bold text-slate-700">
                    {totalUnits} {totalUnits === 1 ? "unidade" : "unidades"} em {cartItems.length} {cartItems.length === 1 ? "produto" : "produtos"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    Total
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-[#12322b]">
                    {formatCurrency(totalInCents)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 max-h-44 overflow-y-auto rounded-2xl border border-slate-200">
                <ul className="divide-y divide-slate-100">
                  {cartItems.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-slate-700">
                          {item.productName}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {item.quantity} × {formatCurrency(item.unitPriceInCents)}
                        </span>
                      </span>
                      <span className="shrink-0 font-bold text-[#12322b]">
                        {formatCurrency(
                          item.unitPriceInCents * Number(item.quantity),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                ref={cancelConfirmationButtonRef}
                type="button"
                onClick={() => setIsConfirmationOpen(false)}
                disabled={isSubmitting}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar e revisar
              </button>
              <button
                type="button"
                onClick={() => void finalizeSale()}
                disabled={isSubmitting}
                className="min-h-11 rounded-xl bg-[#12322b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Finalizando venda..." : "Confirmar e finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

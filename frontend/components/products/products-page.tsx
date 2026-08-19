"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "@/services/products";
import type { Product, ProductInput } from "@/types";

type ProductFormValues = {
  name: string;
  category: string;
  price: string;
  stock: string;
};

type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

const INITIAL_FORM_VALUES: ProductFormValues = {
  name: "",
  category: "",
  price: "",
  stock: "",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatPrice(price: string) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice)
    ? currencyFormatter.format(numericPrice)
    : price;
}

function validateProduct(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const numericPrice = Number(values.price);
  const numericStock = Number(values.stock);

  if (!values.name.trim()) {
    errors.name = "Informe o nome do produto.";
  }

  if (!values.category.trim()) {
    errors.category = "Informe a categoria do produto.";
  }

  if (!values.price.trim()) {
    errors.price = "Informe o pre\u00e7o do produto.";
  } else if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    errors.price = "O preço deve ser maior ou igual a zero.";
  }

  if (!values.stock.trim()) {
    errors.stock = "Informe o estoque do produto.";
  } else if (
    !Number.isInteger(numericStock) ||
    numericStock < 0
  ) {
    errors.stock =
      "O estoque deve ser um número inteiro maior ou igual a zero.";
  }

  return errors;
}

function inputClasses(hasError: boolean) {
  return `mt-2 h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-200 focus:border-emerald-600 focus:ring-emerald-100"
  }`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar os produtos.";
}

function getProductChanges(
  currentProduct: Product,
  nextProduct: ProductInput,
): Partial<ProductInput> {
  const changes: Partial<ProductInput> = {};

  if (nextProduct.name !== currentProduct.name) {
    changes.name = nextProduct.name;
  }

  if (nextProduct.category !== currentProduct.category) {
    changes.category = nextProduct.category;
  }

  if (nextProduct.price !== Number(currentProduct.price).toFixed(2)) {
    changes.price = nextProduct.price;
  }

  if (nextProduct.stock !== currentProduct.stock) {
    changes.stock = nextProduct.stock;
  }

  return changes;
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formValues, setFormValues] =
    useState<ProductFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockRemovalQuantity, setStockRemovalQuantity] = useState("");
  const [stockError, setStockError] = useState<string | null>(null);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const stockQuantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    getProducts(controller.signal)
      .then((loadedProducts) => setProducts(loadedProducts))
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

  useEffect(() => {
    if (isFormOpen) {
      nameInputRef.current?.focus();
    }
  }, [isFormOpen, editingProduct]);

  useEffect(() => {
    if (deletingProduct) {
      cancelDeleteButtonRef.current?.focus();
    }
  }, [deletingProduct]);

  useEffect(() => {
    if (stockProduct) {
      stockQuantityInputRef.current?.focus();
    }
  }, [stockProduct]);

  function openCreateForm() {
    setSuccessMessage(null);
    setActionError(null);
    setSubmitError(null);
    setFormErrors({});
    setFormValues(INITIAL_FORM_VALUES);
    setEditingProduct(null);
    setIsFormOpen(true);
  }

  function openEditForm(product: Product) {
    setSuccessMessage(null);
    setActionError(null);
    setSubmitError(null);
    setFormErrors({});
    setFormValues({
      name: product.name,
      category: product.category,
      price: Number(product.price).toFixed(2),
      stock: String(product.stock),
    });
    setEditingProduct(product);
    setIsFormOpen(true);
  }

  function requestSingleDeletion(product: Product) {
    setSuccessMessage(null);
    setActionError(null);
    setDeletingProduct(product);
  }

  function closeDeleteConfirmation() {
    if (!isDeleting) {
      setDeletingProduct(null);
    }
  }

  async function confirmDeletion() {
    if (!deletingProduct) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);

    try {
      await deleteProduct(deletingProduct.id);
      setProducts((current) =>
        current.filter((product) => product.id !== deletingProduct.id),
      );

      if (editingProduct?.id === deletingProduct.id) {
        setIsFormOpen(false);
        setEditingProduct(null);
        setFormValues(INITIAL_FORM_VALUES);
        setFormErrors({});
        setSubmitError(null);
      }

      setDeletingProduct(null);
      setSuccessMessage(
        `Produto "${deletingProduct.name}" excluído com sucesso.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o produto.";
      setDeletingProduct(null);
      setActionError(
        `Não foi possível excluir "${deletingProduct.name}". ${message}`,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function openStockAdjustment(product: Product) {
    setSuccessMessage(null);
    setActionError(null);
    setStockError(null);
    setStockRemovalQuantity(product.stock > 0 ? "1" : "");
    setStockProduct(product);
  }

  function closeStockAdjustment() {
    if (!isUpdatingStock) {
      setStockProduct(null);
      setStockRemovalQuantity("");
      setStockError(null);
    }
  }

  async function confirmStockAdjustment() {
    if (!stockProduct) {
      return;
    }

    const quantity = Number(stockRemovalQuantity);

    if (
      !stockRemovalQuantity.trim() ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setStockError("Informe uma quantidade inteira maior que zero.");
      return;
    }

    if (quantity > stockProduct.stock) {
      setStockError(
        `A quantidade não pode ser maior que o estoque atual (${stockProduct.stock}).`,
      );
      return;
    }

    const newStock = stockProduct.stock - quantity;
    setIsUpdatingStock(true);
    setStockError(null);

    try {
      const updatedProduct = await updateProduct(stockProduct.id, {
        stock: newStock,
      });
      setProducts((current) =>
        current.map((product) =>
          product.id === updatedProduct.id ? updatedProduct : product,
        ),
      );

      if (editingProduct?.id === updatedProduct.id) {
        setEditingProduct(updatedProduct);
        setFormValues((current) => ({
          ...current,
          stock: String(updatedProduct.stock),
        }));
      }

      setStockProduct(null);
      setStockRemovalQuantity("");
      setSuccessMessage(
        `Baixa realizada com sucesso. Estoque atual: ${updatedProduct.stock}.`,
      );
    } catch (error) {
      setStockError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o estoque. Tente novamente.",
      );
    } finally {
      setIsUpdatingStock(false);
    }
  }

  async function retryLoadProducts() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const loadedProducts = await getProducts();
      setProducts(loadedProducts);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function closeForm() {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setSubmitError(null);
    setFormErrors({});
    setFormValues(INITIAL_FORM_VALUES);
    setEditingProduct(null);
  }

  function updateField(field: keyof ProductFormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateProduct(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const productInput: ProductInput = {
      name: formValues.name.trim(),
      category: formValues.category.trim(),
      price: Number(formValues.price).toFixed(2),
      stock: Number(formValues.stock),
    };

    const changes = editingProduct
      ? getProductChanges(editingProduct, productInput)
      : null;

    if (changes && Object.keys(changes).length === 0) {
      setSubmitError("Nenhuma altera\u00e7\u00e3o foi feita no produto.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedProduct = editingProduct
        ? await updateProduct(editingProduct.id, changes ?? {})
        : await createProduct(productInput);

      setProducts((current) => {
        if (editingProduct) {
          return current.map((product) =>
            product.id === savedProduct.id ? savedProduct : product,
          );
        }

        return [...current, savedProduct].sort(
          (first, second) => first.id - second.id,
        );
      });
      setFormValues(INITIAL_FORM_VALUES);
      setFormErrors({});
      setIsFormOpen(false);
      setEditingProduct(null);
      setSuccessMessage(
        editingProduct
          ? `Produto "${savedProduct.name}" atualizado com sucesso.`
          : `Produto "${savedProduct.name}" cadastrado com sucesso.`,
      );
    } catch (error) {
      const fallbackMessage = editingProduct
        ? "Não foi possível atualizar o produto. Tente novamente."
        : "Não foi possível cadastrar o produto. Tente novamente.";

      setSubmitError(
        error instanceof Error ? error.message : fallbackMessage,
      );
    } finally {
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

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-slate-900/10 pb-6">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
            aria-label={"Voltar para a página inicial"}
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
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/75 px-4 py-2 text-sm font-bold text-[#12322b] shadow-sm transition hover:border-emerald-700/30 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <span aria-hidden="true">&larr;</span>
            <span className="hidden sm:inline">Voltar ao início</span>
            <span className="sm:hidden">Início</span>
          </Link>
        </header>

        <section className="flex-1 py-10 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                Catálogo
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] text-[#102c27] sm:text-5xl">
                Produtos
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                Consulte o catálogo e mantenha os produtos disponíveis para suas
                vendas.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateForm}
              disabled={isSubmitting}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#12322b] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-18px_rgba(18,50,43,0.85)] transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                +
              </span>
              Novo produto
            </button>
          </div>

          {successMessage && (
            <div
              role="status"
              className="mt-7 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-900"
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

          {actionError && (
            <div
              role="alert"
              className="mt-7 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-800"
            >
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
              >
                !
              </span>
              <span className="pt-0.5">{actionError}</span>
            </div>
          )}

          {isFormOpen && (
            <section
              aria-labelledby="product-form-title"
              className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)] sm:p-7"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                    {editingProduct ? "Edição" : "Cadastro"}
                  </p>
                  <h2
                    id="product-form-title"
                    className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
                  >
                    {editingProduct ? "Editar produto" : "Novo produto"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {editingProduct
                      ? "Altere os dados que deseja atualizar."
                      : "Preencha os dados para adicionar o item ao catálogo."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={"Fechar formul\u00e1rio"}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-7">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="product-name"
                      className="text-sm font-bold text-slate-700"
                    >
                      Nome
                    </label>
                    <input
                      ref={nameInputRef}
                      id="product-name"
                      name="name"
                      type="text"
                      maxLength={100}
                      autoComplete="off"
                      value={formValues.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      aria-invalid={Boolean(formErrors.name)}
                      aria-describedby={formErrors.name ? "product-name-error" : undefined}
                      placeholder={"Ex.: Caf\u00e9 especial"}
                      className={inputClasses(Boolean(formErrors.name))}
                    />
                    {formErrors.name && (
                      <p id="product-name-error" className="mt-2 text-xs font-medium text-red-600">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="product-category"
                      className="text-sm font-bold text-slate-700"
                    >
                      Categoria
                    </label>
                    <input
                      id="product-category"
                      name="category"
                      type="text"
                      maxLength={100}
                      autoComplete="off"
                      value={formValues.category}
                      onChange={(event) =>
                        updateField("category", event.target.value)
                      }
                      aria-invalid={Boolean(formErrors.category)}
                      aria-describedby={
                        formErrors.category ? "product-category-error" : undefined
                      }
                      placeholder="Ex.: Alimentos"
                      className={inputClasses(Boolean(formErrors.category))}
                    />
                    {formErrors.category && (
                      <p id="product-category-error" className="mt-2 text-xs font-medium text-red-600">
                        {formErrors.category}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="product-price"
                      className="text-sm font-bold text-slate-700"
                    >
                      Preço
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-sm font-medium text-slate-400">
                        R$
                      </span>
                      <input
                        id="product-price"
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={formValues.price}
                        onChange={(event) =>
                          updateField("price", event.target.value)
                        }
                        aria-invalid={Boolean(formErrors.price)}
                        aria-describedby={
                          formErrors.price ? "product-price-error" : undefined
                        }
                        placeholder="0,00"
                        className={`${inputClasses(Boolean(formErrors.price))} pl-12`}
                      />
                    </div>
                    {formErrors.price && (
                      <p id="product-price-error" className="mt-2 text-xs font-medium text-red-600">
                        {formErrors.price}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="product-stock"
                      className="text-sm font-bold text-slate-700"
                    >
                      Estoque
                    </label>
                    <input
                      id="product-stock"
                      name="stock"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={formValues.stock}
                      onChange={(event) =>
                        updateField("stock", event.target.value)
                      }
                      aria-invalid={Boolean(formErrors.stock)}
                      aria-describedby={
                        formErrors.stock ? "product-stock-error" : undefined
                      }
                      placeholder="0"
                      className={inputClasses(Boolean(formErrors.stock))}
                    />
                    {formErrors.stock && (
                      <p id="product-stock-error" className="mt-2 text-xs font-medium text-red-600">
                        {formErrors.stock}
                      </p>
                    )}
                  </div>
                </div>

                {submitError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {submitError}
                  </p>
                )}

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={isSubmitting}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-11 rounded-xl bg-[#12322b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? "Salvando..."
                      : editingProduct
                        ? "Salvar alterações"
                        : "Cadastrar produto"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section
            aria-labelledby="products-list-title"
            className="mt-7 overflow-hidden rounded-3xl border border-slate-900/10 bg-white/90 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-900/10 px-5 py-5 sm:px-7">
              <div>
                <h2
                  id="products-list-title"
                  className="text-lg font-bold tracking-[-0.025em] text-[#12322b]"
                >
                  Produtos cadastrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Itens disponíveis no catálogo da loja.
                </p>
              </div>
              {!isLoading && !loadError && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  {products.length} {products.length === 1 ? "item" : "itens"}
                </span>
              )}
            </div>

            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-4 px-5 py-7 sm:px-7"
              >
                <span className="sr-only">Carregando produtos...</span>
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="grid animate-pulse grid-cols-4 gap-4"
                  >
                    <span className="h-4 rounded bg-slate-100" />
                    <span className="h-4 rounded bg-slate-100" />
                    <span className="h-4 rounded bg-slate-100" />
                    <span className="h-4 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600">
                  !
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Não foi possível carregar os produtos
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={retryLoadProducts}
                  className="mt-5 min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-[#12322b] transition hover:border-emerald-700/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Tentar novamente
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                  0
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Nenhum produto cadastrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Cadastre o primeiro produto para começar a montar seu catálogo.
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 min-h-11 rounded-xl bg-[#12322b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Cadastrar primeiro produto
                </button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        <th scope="col" className="px-7 py-4">
                          Nome
                        </th>
                        <th scope="col" className="px-5 py-4">
                          Categoria
                        </th>
                        <th scope="col" className="px-5 py-4 text-right">
                          Preço
                        </th>
                        <th scope="col" className="px-7 py-4 text-right">
                          Estoque
                        </th>
                        <th scope="col" className="px-7 py-4 text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((product) => (
                        <tr
                          key={product.id}
                          className="transition hover:bg-emerald-50/35"
                        >
                          <td className="px-7 py-4 text-sm font-bold text-slate-800">
                            {product.name}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {product.category}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">
                            {formatPrice(product.price)}
                          </td>
                          <td className="px-7 py-4 text-right">
                            <StockBadge stock={product.stock} />
                          </td>
                          <td className="px-7 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditForm(product)}
                                disabled={isSubmitting || isDeleting || isUpdatingStock}
                                className="min-h-9 rounded-lg border border-emerald-800/15 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-700/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Editar ${product.name}`}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => openStockAdjustment(product)}
                                disabled={isSubmitting || isDeleting || isUpdatingStock}
                                className="min-h-9 rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-xs font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Dar baixa no estoque de ${product.name}`}
                              >
                                Dar baixa
                              </button>
                              <button
                                type="button"
                                onClick={() => requestSingleDeletion(product)}
                                disabled={isSubmitting || isDeleting || isUpdatingStock}
                                className="min-h-9 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Excluir ${product.name}`}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-slate-100 sm:hidden">
                  {products.map((product) => (
                    <li key={product.id} className="px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-800">
                            {product.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {product.category}
                          </p>
                        </div>
                        <StockBadge stock={product.stock} />
                      </div>
                      <div className="mt-4 flex flex-col items-start gap-3">
                        <p className="text-sm font-bold text-[#12322b]">
                          {formatPrice(product.price)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            disabled={isSubmitting || isDeleting || isUpdatingStock}
                            className="min-h-9 rounded-lg border border-emerald-800/15 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-700/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Editar ${product.name}`}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => openStockAdjustment(product)}
                            disabled={isSubmitting || isDeleting || isUpdatingStock}
                            className="min-h-9 rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-xs font-bold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Dar baixa no estoque de ${product.name}`}
                          >
                            Dar baixa
                          </button>
                          <button
                            type="button"
                            onClick={() => requestSingleDeletion(product)}
                            disabled={isSubmitting || isDeleting || isUpdatingStock}
                            className="min-h-9 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Excluir ${product.name}`}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-900/10 pt-5 text-xs text-slate-500">
          <p>StoreSales</p>
          <p>Gestão simples para vender melhor.</p>
        </footer>
      </div>

      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjustment-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeStockAdjustment();
              }
            }}
            className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl sm:p-7"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-sky-50 text-lg font-bold text-sky-700">
              &minus;
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
              Movimentação de estoque
            </p>
            <h2
              id="stock-adjustment-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
            >
              Dar baixa
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Produto
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {stockProduct.name}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Estoque atual
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {stockProduct.stock}
                </p>
              </div>
            </div>

            <form
              className="mt-5"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void confirmStockAdjustment();
              }}
            >
              <label
                htmlFor="stock-removal-quantity"
                className="text-sm font-bold text-slate-700"
              >
                Quantidade a remover
              </label>
              <input
                ref={stockQuantityInputRef}
                id="stock-removal-quantity"
                type="number"
                min="1"
                max={stockProduct.stock}
                step="1"
                inputMode="numeric"
                value={stockRemovalQuantity}
                onChange={(event) => {
                  setStockRemovalQuantity(event.target.value);
                  setStockError(null);
                }}
                aria-invalid={Boolean(stockError)}
                aria-describedby={stockError ? "stock-removal-error" : undefined}
                placeholder="Ex.: 1"
                className={inputClasses(Boolean(stockError))}
              />
              {stockError && (
                <p
                  id="stock-removal-error"
                  role="alert"
                  className="mt-2 text-xs font-medium text-red-600"
                >
                  {stockError}
                </p>
              )}
              {stockProduct.stock === 0 && !stockError && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Este produto já está com o estoque zerado.
                </p>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeStockAdjustment}
                  disabled={isUpdatingStock}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStock}
                  className="min-h-11 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingStock ? "Atualizando..." : "Confirmar baixa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            aria-describedby="delete-confirmation-description"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeDeleteConfirmation();
              }
            }}
            className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl sm:p-7"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-700">
              !
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-red-600">
              Confirmação necessária
            </p>
            <h2
              id="delete-confirmation-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
            >
              Excluir produto?
            </h2>
            <p
              id="delete-confirmation-description"
              className="mt-3 text-sm leading-6 text-slate-600"
            >
              Tem certeza que deseja excluir permanentemente o produto
              {` "${deletingProduct.name}"?`} Esta ação não pode ser desfeita.
            </p>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelDeleteButtonRef}
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={isDeleting}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDeletion()}
                disabled={isDeleting}
                className="min-h-11 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Excluindo..." : "Excluir produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StockBadge({ stock }: { stock: number }) {
  const classes =
    stock > 0
      ? "bg-emerald-50 text-emerald-800"
      : "bg-amber-50 text-amber-800";

  return (
    <span
      className={`inline-flex min-w-14 justify-center rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}
    >
      {stock}
    </span>
  );
}

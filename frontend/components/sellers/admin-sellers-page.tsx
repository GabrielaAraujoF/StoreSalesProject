"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createSeller,
  getSellers,
  updateSeller,
} from "@/services/sellers";
import { logout } from "@/services/auth";
import type { Account, Seller, SellerInput } from "@/types";

type SellerFormValues = {
  name: string;
  email: string;
};

type SellerFormErrors = Partial<Record<keyof SellerFormValues, string>>;

const INITIAL_FORM_VALUES: SellerFormValues = {
  name: "",
  email: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClasses = (hasError: boolean) =>
  `mt-2 h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-200 focus:border-emerald-600 focus:ring-emerald-100"
  }`;

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatSellerNumber(sellerNumber: number) {
  return String(sellerNumber).padStart(3, "0");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function validateSeller(values: SellerFormValues): SellerFormErrors {
  const errors: SellerFormErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();

  if (!name) {
    errors.name = "Informe o nome do vendedor.";
  } else if (name.length > 100) {
    errors.name = "O nome deve ter no máximo 100 caracteres.";
  }

  if (!email) {
    errors.email = "Informe o e-mail do vendedor.";
  } else if (email.length > 100) {
    errors.email = "O e-mail deve ter no máximo 100 caracteres.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  return errors;
}

function SellerStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        active
          ? "bg-emerald-50 text-emerald-800"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function AdminSellersPage({ account }: { account: Account }) {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [formValues, setFormValues] =
    useState<SellerFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<SellerFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusSellerId, setStatusSellerId] = useState<number | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deactivatingSeller, setDeactivatingSeller] = useState<Seller | null>(
    null,
  );
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeactivationButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    getSellers(controller.signal)
      .then((loadedSellers) =>
        setSellers(
          [...loadedSellers].sort(
            (first, second) => first.seller_number - second.seller_number,
          ),
        ),
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            getErrorMessage(error, "Não foi possível carregar os vendedores."),
          );
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
  }, [isFormOpen, editingSeller]);

  useEffect(() => {
    if (deactivatingSeller) {
      cancelDeactivationButtonRef.current?.focus();
    }
  }, [deactivatingSeller]);

  const filteredSellers = useMemo(() => {
    const query = searchable(searchTerm.trim());

    if (!query) {
      return sellers;
    }

    return sellers.filter((seller) =>
      searchable(
        `${seller.name} ${seller.email} ${seller.seller_number} ${formatSellerNumber(seller.seller_number)}`,
      ).includes(query),
    );
  }, [searchTerm, sellers]);

  function clearMessages() {
    setSuccessMessage(null);
    setActionError(null);
    setSubmitError(null);
  }

  function openCreateForm() {
    clearMessages();
    setFormErrors({});
    setFormValues(INITIAL_FORM_VALUES);
    setEditingSeller(null);
    setIsFormOpen(true);
  }

  function openEditForm(seller: Seller) {
    clearMessages();
    setFormErrors({});
    setFormValues({
      name: seller.name,
      email: seller.email,
    });
    setEditingSeller(seller);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setEditingSeller(null);
    setFormValues(INITIAL_FORM_VALUES);
    setFormErrors({});
    setSubmitError(null);
  }

  function updateField(field: keyof SellerFormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  async function retryLoadSellers() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const loadedSellers = await getSellers();
      setSellers(
        [...loadedSellers].sort(
          (first, second) => first.seller_number - second.seller_number,
        ),
      );
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "Não foi possível carregar os vendedores."),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateSeller(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const sellerInput: SellerInput = {
      name: formValues.name.trim(),
      email: formValues.email.trim().toLocaleLowerCase("pt-BR"),
    };

    if (
      editingSeller &&
      sellerInput.name === editingSeller.name &&
      sellerInput.email === editingSeller.email
    ) {
      setSubmitError("Nenhuma alteração foi feita no vendedor.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedSeller = editingSeller
        ? await updateSeller(editingSeller.id, sellerInput)
        : await createSeller(sellerInput);

      setSellers((current) => {
        const nextSellers = editingSeller
          ? current.map((seller) =>
              seller.id === savedSeller.id ? savedSeller : seller,
            )
          : [...current, savedSeller];

        return nextSellers.sort(
          (first, second) => first.seller_number - second.seller_number,
        );
      });
      setIsFormOpen(false);
      setEditingSeller(null);
      setFormValues(INITIAL_FORM_VALUES);
      setFormErrors({});
      setSuccessMessage(
        editingSeller
          ? `Vendedor "${savedSeller.name}" atualizado com sucesso.`
          : `Vendedor "${savedSeller.name}" cadastrado com o número ${formatSellerNumber(savedSeller.seller_number)}.`,
      );
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          editingSeller
            ? "Não foi possível atualizar o vendedor."
            : "Não foi possível cadastrar o vendedor.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeSellerStatus(seller: Seller, active: boolean) {
    setStatusSellerId(seller.id);
    setSuccessMessage(null);
    setActionError(null);

    try {
      const updatedSeller = await updateSeller(seller.id, { active });
      setSellers((current) =>
        current.map((currentSeller) =>
          currentSeller.id === updatedSeller.id
            ? updatedSeller
            : currentSeller,
        ),
      );
      setSuccessMessage(
        `Vendedor "${updatedSeller.name}" ${active ? "ativado" : "inativado"} com sucesso.`,
      );
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          `Não foi possível ${active ? "ativar" : "inativar"} o vendedor.`,
        ),
      );
    } finally {
      setStatusSellerId(null);
    }
  }

  function requestStatusChange(seller: Seller) {
    clearMessages();

    if (seller.active) {
      setDeactivatingSeller(seller);
      return;
    }

    void changeSellerStatus(seller, true);
  }

  async function confirmDeactivation() {
    if (!deactivatingSeller) {
      return;
    }

    const seller = deactivatingSeller;
    await changeSellerStatus(seller, false);
    setDeactivatingSeller(null);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setActionError(null);

    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Não foi possível encerrar a sessão."),
      );
      setIsLoggingOut(false);
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
        <header className="flex items-center justify-between gap-4 border-b border-slate-900/10 pb-6">
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

          <div className="flex items-center gap-2">
            <div className="hidden text-right lg:block">
              <p className="max-w-48 truncate text-xs font-bold text-[#12322b]">
                {account.name}
              </p>
              <p className="max-w-48 truncate text-xs text-slate-500">
                {account.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-900/10 bg-white/75 px-4 py-2 text-sm font-bold text-[#12322b] shadow-sm transition hover:border-emerald-700/30 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Saindo..." : "Sair"}
            </button>
            <Link
              href="/"
              aria-label="Voltar ao início"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-900/10 bg-white/75 px-4 py-2 text-sm font-bold text-[#12322b] shadow-sm transition hover:border-emerald-700/30 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
            >
              <span aria-hidden="true">&larr;</span>
              <span className="hidden sm:inline">Início</span>
            </Link>
          </div>
        </header>

        <section className="flex-1 py-10 sm:py-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Equipe da loja
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] text-[#102c27] sm:text-5xl">
              Administração
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
              Gerencie os vendedores da loja.
            </p>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="seller-search" className="sr-only">
                Buscar vendedor
              </label>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                &#9906;
              </span>
              <input
                id="seller-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar vendedor..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white/90 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <button
              type="button"
              onClick={openCreateForm}
              disabled={isSubmitting || statusSellerId !== null}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#12322b] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-18px_rgba(18,50,43,0.85)] transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                +
              </span>
              Novo vendedor
            </button>
          </div>

          {successMessage && (
            <div
              role="status"
              className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-900"
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
              className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-800"
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
              aria-labelledby="seller-form-title"
              className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)] sm:p-7"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                    {editingSeller ? "Edição" : "Cadastro"}
                  </p>
                  <h2
                    id="seller-form-title"
                    className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
                  >
                    {editingSeller ? "Editar vendedor" : "Novo vendedor"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {editingSeller
                      ? `Atualize os dados do vendedor nº ${formatSellerNumber(editingSeller.seller_number)}.`
                      : "O número será gerado automaticamente após o cadastro."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSubmitting}
                  aria-label="Fechar formulário"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-7">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="seller-name"
                      className="text-sm font-bold text-slate-700"
                    >
                      Nome
                    </label>
                    <input
                      ref={nameInputRef}
                      id="seller-name"
                      name="name"
                      type="text"
                      maxLength={100}
                      autoComplete="name"
                      value={formValues.name}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      aria-invalid={Boolean(formErrors.name)}
                      aria-describedby={
                        formErrors.name ? "seller-name-error" : undefined
                      }
                      placeholder="Ex.: João Silva"
                      className={inputClasses(Boolean(formErrors.name))}
                    />
                    {formErrors.name && (
                      <p
                        id="seller-name-error"
                        className="mt-2 text-xs font-medium text-red-600"
                      >
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="seller-email"
                      className="text-sm font-bold text-slate-700"
                    >
                      E-mail
                    </label>
                    <input
                      id="seller-email"
                      name="email"
                      type="email"
                      maxLength={100}
                      autoComplete="email"
                      value={formValues.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      aria-invalid={Boolean(formErrors.email)}
                      aria-describedby={
                        formErrors.email ? "seller-email-error" : undefined
                      }
                      placeholder="Ex.: joao@email.com"
                      className={inputClasses(Boolean(formErrors.email))}
                    />
                    {formErrors.email && (
                      <p
                        id="seller-email-error"
                        className="mt-2 text-xs font-medium text-red-600"
                      >
                        {formErrors.email}
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
                      : editingSeller
                        ? "Salvar alterações"
                        : "Cadastrar vendedor"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section
            aria-labelledby="sellers-list-title"
            className="mt-7 overflow-hidden rounded-3xl border border-slate-900/10 bg-white/90 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)]"
          >
            <div className="flex items-end justify-between gap-4 border-b border-slate-900/10 px-5 py-5 sm:px-7">
              <div>
                <h2
                  id="sellers-list-title"
                  className="text-lg font-bold tracking-[-0.025em] text-[#12322b]"
                >
                  Vendedores cadastrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Equipe disponível para atendimento e vendas.
                </p>
              </div>
              {!isLoading && !loadError && (
                <span className="hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:inline-flex">
                  {sellers.length} {sellers.length === 1 ? "vendedor" : "vendedores"}
                </span>
              )}
            </div>

            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-3 p-5 sm:p-7"
              >
                <span className="sr-only">Carregando vendedores...</span>
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="grid animate-pulse grid-cols-[4rem_1fr_6rem] items-center gap-4 rounded-xl border border-slate-100 p-4"
                  >
                    <span className="h-4 rounded bg-slate-100" />
                    <span className="h-4 rounded bg-slate-100" />
                    <span className="h-7 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600">
                  !
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Não foi possível carregar os vendedores
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void retryLoadSellers()}
                  className="mt-5 min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-[#12322b] transition hover:border-emerald-700/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Tentar novamente
                </button>
              </div>
            ) : sellers.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                  0
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Nenhum vendedor cadastrado.
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Cadastre o primeiro vendedor para iniciar a equipe da loja.
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 min-h-11 rounded-xl bg-[#12322b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Novo vendedor
                </button>
              </div>
            ) : filteredSellers.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-sky-50 text-lg font-bold text-sky-700">
                  ?
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Nenhum vendedor encontrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Tente buscar por outro nome, e-mail ou número.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="mt-5 min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-[#12322b] transition hover:border-emerald-700/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.1em] text-slate-500">
                      <tr>
                        <th scope="col" className="w-[12%] px-6 py-3.5 font-bold">
                          Número
                        </th>
                        <th scope="col" className="w-[25%] px-4 py-3.5 font-bold">
                          Vendedor
                        </th>
                        <th scope="col" className="w-[28%] px-4 py-3.5 font-bold">
                          E-mail
                        </th>
                        <th scope="col" className="w-[13%] px-4 py-3.5 font-bold">
                          Status
                        </th>
                        <th scope="col" className="w-[22%] px-6 py-3.5 text-right font-bold">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSellers.map((seller) => (
                        <tr key={seller.id} className="transition hover:bg-emerald-50/35">
                          <td className="px-6 py-4 align-middle">
                            <span className="font-mono text-sm font-bold text-emerald-800">
                              {formatSellerNumber(seller.seller_number)}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <p className="break-words text-sm font-bold text-slate-800">
                              {seller.name}
                            </p>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <p className="break-all text-sm text-slate-600">
                              {seller.email}
                            </p>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <SellerStatusBadge active={seller.active} />
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditForm(seller)}
                                disabled={isSubmitting || statusSellerId !== null}
                                className="min-h-9 rounded-lg border border-emerald-800/15 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-700/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => requestStatusChange(seller)}
                                disabled={isSubmitting || statusSellerId !== null}
                                className={`min-h-9 rounded-lg border bg-white px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  seller.active
                                    ? "border-amber-200 text-amber-800 hover:border-amber-300 hover:bg-amber-50 focus-visible:ring-amber-200"
                                    : "border-emerald-200 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 focus-visible:ring-emerald-200"
                                }`}
                              >
                                {statusSellerId === seller.id
                                  ? "Atualizando..."
                                  : seller.active
                                    ? "Desativar"
                                    : "Ativar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="grid gap-4 p-5 md:hidden">
                  {filteredSellers.map((seller) => (
                    <li
                      key={seller.id}
                      className="rounded-2xl border border-slate-900/10 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="break-words font-bold text-slate-800">
                            {seller.name}
                          </h3>
                          <p className="mt-1 font-mono text-sm font-bold text-emerald-800">
                            Nº {formatSellerNumber(seller.seller_number)}
                          </p>
                        </div>
                        <SellerStatusBadge active={seller.active} />
                      </div>
                      <p className="mt-4 break-all rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
                        {seller.email}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => openEditForm(seller)}
                          disabled={isSubmitting || statusSellerId !== null}
                          className="min-h-10 flex-1 rounded-lg border border-emerald-800/15 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-700/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => requestStatusChange(seller)}
                          disabled={isSubmitting || statusSellerId !== null}
                          className={`min-h-10 flex-1 rounded-lg border bg-white px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${
                            seller.active
                              ? "border-amber-200 text-amber-800 hover:bg-amber-50 focus-visible:ring-amber-200"
                              : "border-emerald-200 text-emerald-800 hover:bg-emerald-50 focus-visible:ring-emerald-200"
                          }`}
                        >
                          {statusSellerId === seller.id
                            ? "Atualizando..."
                            : seller.active
                              ? "Desativar"
                              : "Ativar"}
                        </button>
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

      {deactivatingSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deactivate-seller-title"
            aria-describedby="deactivate-seller-description"
            onKeyDown={(event) => {
              if (event.key === "Escape" && statusSellerId === null) {
                setDeactivatingSeller(null);
              }
            }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
          >
            <div className="p-6 sm:p-7">
              <span className="flex size-11 items-center justify-center rounded-full bg-amber-50 text-lg font-bold text-amber-700">
                !
              </span>
              <h2
                id="deactivate-seller-title"
                className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
              >
                Desativar vendedor?
              </h2>
              <p
                id="deactivate-seller-description"
                className="mt-2 text-sm leading-6 text-slate-600"
              >
                Deseja realmente desativar o vendedor &ldquo;
                {deactivatingSeller.name}&rdquo;?
                Ele permanecerá na listagem, mas não poderá realizar novas vendas.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                ref={cancelDeactivationButtonRef}
                type="button"
                onClick={() => setDeactivatingSeller(null)}
                disabled={statusSellerId !== null}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDeactivation()}
                disabled={statusSellerId !== null}
                className="min-h-11 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {statusSellerId !== null ? "Desativando..." : "Desativar vendedor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

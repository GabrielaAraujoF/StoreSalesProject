"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "@/services/customers";
import type { Customer, CustomerInput } from "@/types";

type CustomerFormValues = {
  name: string;
  phone: string;
};

type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>;

const INITIAL_FORM_VALUES: CustomerFormValues = {
  name: "",
  phone: "",
};

const inputClasses = (hasError: boolean) =>
  `mt-2 h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-200 focus:border-emerald-600 focus:ring-emerald-100"
  }`;

function validateCustomer(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  const name = values.name.trim();
  const phone = values.phone.trim();

  if (!name) {
    errors.name = "Informe o nome do cliente.";
  } else if (name.length > 100) {
    errors.name = "O nome deve ter no máximo 100 caracteres.";
  }

  if (phone.length > 20) {
    errors.phone = "O telefone deve ter no máximo 20 caracteres.";
  }

  return errors;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function searchable(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatPhone(phone: string | null) {
  if (!phone) {
    return "Não informado";
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formValues, setFormValues] =
    useState<CustomerFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    getCustomers(controller.signal)
      .then(setCustomers)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            getErrorMessage(error, "Não foi possível carregar os clientes."),
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
  }, [isFormOpen, editingCustomer]);

  useEffect(() => {
    if (deletingCustomer) {
      cancelDeleteButtonRef.current?.focus();
    }
  }, [deletingCustomer]);

  const filteredCustomers = useMemo(() => {
    const query = searchable(searchTerm.trim());

    if (!query) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        searchable(customer.name).includes(query) ||
        searchable(customer.phone).includes(query),
    );
  }, [customers, searchTerm]);

  function clearMessages() {
    setSuccessMessage(null);
    setActionError(null);
    setSubmitError(null);
  }

  function openCreateForm() {
    clearMessages();
    setFormErrors({});
    setFormValues(INITIAL_FORM_VALUES);
    setEditingCustomer(null);
    setIsFormOpen(true);
  }

  function openEditForm(customer: Customer) {
    clearMessages();
    setFormErrors({});
    setFormValues({
      name: customer.name,
      phone: customer.phone ?? "",
    });
    setEditingCustomer(customer);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setEditingCustomer(null);
    setFormValues(INITIAL_FORM_VALUES);
    setFormErrors({});
    setSubmitError(null);
  }

  function updateField(field: keyof CustomerFormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  async function retryLoadCustomers() {
    setIsLoading(true);
    setLoadError(null);

    try {
      setCustomers(await getCustomers());
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "Não foi possível carregar os clientes."),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateCustomer(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const customerInput: CustomerInput = {
      name: formValues.name.trim(),
      phone: formValues.phone.trim() || null,
    };

    if (
      editingCustomer &&
      customerInput.name === editingCustomer.name &&
      customerInput.phone === editingCustomer.phone
    ) {
      setSubmitError("Nenhuma alteração foi feita no cliente.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedCustomer = editingCustomer
        ? await updateCustomer(editingCustomer.id, customerInput)
        : await createCustomer(customerInput);

      setCustomers((current) => {
        if (editingCustomer) {
          return current.map((customer) =>
            customer.id === savedCustomer.id ? savedCustomer : customer,
          );
        }

        return [...current, savedCustomer].sort(
          (first, second) => first.id - second.id,
        );
      });
      setIsFormOpen(false);
      setEditingCustomer(null);
      setFormValues(INITIAL_FORM_VALUES);
      setFormErrors({});
      setSuccessMessage(
        editingCustomer
          ? `Cliente "${savedCustomer.name}" atualizado com sucesso.`
          : `Cliente "${savedCustomer.name}" cadastrado com sucesso.`,
      );
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          editingCustomer
            ? "Não foi possível atualizar o cliente."
            : "Não foi possível cadastrar o cliente.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestDeletion(customer: Customer) {
    clearMessages();
    setDeletingCustomer(customer);
  }

  function closeDeleteConfirmation() {
    if (!isDeleting) {
      setDeletingCustomer(null);
    }
  }

  async function confirmDeletion() {
    if (!deletingCustomer) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);

    try {
      await deleteCustomer(deletingCustomer.id);
      setCustomers((current) =>
        current.filter((customer) => customer.id !== deletingCustomer.id),
      );

      if (editingCustomer?.id === deletingCustomer.id) {
        closeForm();
      }

      setSuccessMessage(
        `Cliente "${deletingCustomer.name}" excluído com sucesso.`,
      );
      setDeletingCustomer(null);
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Não foi possível excluir o cliente."),
      );
      setDeletingCustomer(null);
    } finally {
      setIsDeleting(false);
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
                Relacionamento
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em] text-[#102c27] sm:text-5xl">
                Clientes
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                Mantenha os contatos organizados e encontre cada cliente com
                rapidez.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateForm}
              disabled={isSubmitting || isDeleting}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#12322b] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-18px_rgba(18,50,43,0.85)] transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                +
              </span>
              Novo cliente
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
              aria-labelledby="customer-form-title"
              className="mt-7 rounded-3xl border border-slate-900/10 bg-white/90 p-5 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)] sm:p-7"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                    {editingCustomer ? "Edição" : "Cadastro"}
                  </p>
                  <h2
                    id="customer-form-title"
                    className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
                  >
                    {editingCustomer ? "Editar cliente" : "Novo cliente"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {editingCustomer
                      ? "Atualize os dados de contato do cliente."
                      : "Informe o nome e, se desejar, um telefone para contato."}
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
                      htmlFor="customer-name"
                      className="text-sm font-bold text-slate-700"
                    >
                      Nome
                    </label>
                    <input
                      ref={nameInputRef}
                      id="customer-name"
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
                        formErrors.name ? "customer-name-error" : undefined
                      }
                      placeholder="Ex.: Maria da Silva"
                      className={inputClasses(Boolean(formErrors.name))}
                    />
                    {formErrors.name && (
                      <p
                        id="customer-name-error"
                        className="mt-2 text-xs font-medium text-red-600"
                      >
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="customer-phone"
                        className="text-sm font-bold text-slate-700"
                      >
                        Telefone
                      </label>
                      <span className="text-xs font-medium text-slate-400">
                        Opcional
                      </span>
                    </div>
                    <input
                      id="customer-phone"
                      name="phone"
                      type="tel"
                      maxLength={20}
                      autoComplete="tel"
                      value={formValues.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      aria-invalid={Boolean(formErrors.phone)}
                      aria-describedby={
                        formErrors.phone ? "customer-phone-error" : undefined
                      }
                      placeholder="Ex.: 11999999999"
                      className={inputClasses(Boolean(formErrors.phone))}
                    />
                    {formErrors.phone && (
                      <p
                        id="customer-phone-error"
                        className="mt-2 text-xs font-medium text-red-600"
                      >
                        {formErrors.phone}
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
                      : editingCustomer
                        ? "Salvar alterações"
                        : "Cadastrar cliente"}
                  </button>
                </div>
              </form>
            </section>
          )}
          <section
            aria-labelledby="customers-list-title"
            className="mt-7 overflow-hidden rounded-3xl border border-slate-900/10 bg-white/90 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.5)]"
          >
            <div className="border-b border-slate-900/10 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2
                    id="customers-list-title"
                    className="text-lg font-bold tracking-[-0.025em] text-[#12322b]"
                  >
                    Clientes cadastrados
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Contatos disponíveis para atendimento e vendas.
                  </p>
                </div>
                {!isLoading && !loadError && (
                  <span className="w-fit shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                    {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
                  </span>
                )}
              </div>

              {!isLoading && !loadError && customers.length > 0 && (
                <div className="relative mt-5">
                  <label htmlFor="customer-search" className="sr-only">
                    Buscar cliente
                  </label>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    &#9906;
                  </span>
                  <input
                    id="customer-search"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nome ou telefone"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              )}
            </div>

            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7"
              >
                <span className="sr-only">Carregando clientes...</span>
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-slate-100 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-11 rounded-full bg-slate-100" />
                      <span className="h-4 w-2/3 rounded bg-slate-100" />
                    </div>
                    <span className="mt-5 block h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600">
                  !
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Não foi possível carregar os clientes
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void retryLoadCustomers()}
                  className="mt-5 min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-[#12322b] transition hover:border-emerald-700/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Tentar novamente
                </button>
              </div>
            ) : customers.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                  0
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Nenhum cliente cadastrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Cadastre o primeiro cliente para começar a organizar seus contatos.
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 min-h-11 rounded-xl bg-[#12322b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#19463c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                >
                  Cadastrar primeiro cliente
                </button>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-7">
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-sky-50 text-lg font-bold text-sky-700">
                  ?
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  Nenhum cliente encontrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Tente buscar por outro nome ou telefone.
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
              <ul className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                {filteredCustomers.map((customer) => (
                  <li
                    key={customer.id}
                    className="flex min-h-48 flex-col justify-between rounded-2xl border border-slate-900/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-700/25 hover:shadow-[0_18px_40px_-30px_rgba(15,23,42,0.5)]"
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold uppercase text-emerald-800"
                        >
                          {customer.name.charAt(0)}
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <h3 className="break-words font-bold text-slate-800">
                            {customer.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Cliente #{customer.id}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Telefone
                        </p>
                        <p
                          className={`mt-1 text-sm font-semibold ${
                            customer.phone ? "text-slate-700" : "text-slate-400"
                          }`}
                        >
                          {formatPhone(customer.phone)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(customer)}
                        disabled={isSubmitting || isDeleting}
                        aria-label={`Editar ${customer.name}`}
                        className="min-h-9 rounded-lg border border-emerald-800/15 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-700/35 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeletion(customer)}
                        disabled={isSubmitting || isDeleting}
                        aria-label={`Excluir ${customer.name}`}
                        className="min-h-9 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-900/10 pt-5 text-xs text-slate-500">
          <p>StoreSales</p>
          <p>Gestão simples para vender melhor.</p>
        </footer>
      </div>

      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-customer-title"
            aria-describedby="delete-customer-description"
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
              id="delete-customer-title"
              className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#12322b]"
            >
              Excluir cliente?
            </h2>
            <p
              id="delete-customer-description"
              className="mt-3 text-sm leading-6 text-slate-600"
            >
              Tem certeza que deseja excluir permanentemente
              {` "${deletingCustomer.name}"?`} Esta ação não pode ser desfeita.
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
                {isDeleting ? "Excluindo..." : "Excluir cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

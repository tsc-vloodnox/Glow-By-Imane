import Link from "next/link";

import { getCustomerStats } from "@/lib/customer-stats";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";

type Props = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "revendeurs", label: "Revendeurs" },
];

export default async function AdminClientesPage({ searchParams }: Props) {
  await requireAdmin();

  const { q = "", type = "" } = await searchParams;
  const search = q.trim();
  const digits = search.replace(/\D/g, "");

  const customers = await prisma.customer.findMany({
    where: {
      ...(type === "revendeurs" ? { isReseller: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { businessName: { contains: search, mode: "insensitive" as const } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : {}),
    },
    take: 500,
  });

  const stats = await getCustomerStats(customers.map((c) => c.id));
  const rows = customers
    .map((customer) => ({ customer, stats: stats.get(customer.id) }))
    // Clientes les plus récemment actives en premier
    .sort(
      (a, b) =>
        (b.stats?.lastOrderAt?.getTime() ?? b.customer.createdAt.getTime()) -
        (a.stats?.lastOrderAt?.getTime() ?? a.customer.createdAt.getTime()),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Fiches créées automatiquement à chaque commande, regroupées par numéro de téléphone.
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Nom, boutique ou téléphone"
          className="min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
        />
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <button className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white">
          Rechercher
        </button>
      </form>

      <div className="flex gap-1.5">
        {FILTERS.map((filter) => {
          const isActive = filter.value === type;
          const params = new URLSearchParams({ ...(search ? { q: search } : {}), ...(filter.value ? { type: filter.value } : {}) });
          return (
            <Link
              key={filter.value}
              href={`/admin/clientes${params.size ? `?${params}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                isActive
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          Aucune cliente trouvée.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ customer, stats: s }) => (
            <Link
              key={customer.id}
              href={`/admin/clientes/${customer.id}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 transition-colors hover:border-[var(--color-accent)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{customer.name}</span>
                  {customer.isReseller && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                      Revendeur
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                  {customer.businessName ? `${customer.businessName} · ` : ""}
                  {customer.quartier} · +{customer.phone}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums">
                  {(s?.totalSpent ?? 0).toLocaleString("fr-GN")} GNF
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {s?.orderCount ?? 0} commande{(s?.orderCount ?? 0) > 1 ? "s" : ""}
                  {s?.lastOrderAt
                    ? ` · ${s.lastOrderAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                    : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Données collectées par Glow by Imane et leur utilisation.",
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--color-foreground)]">
      <Link href="/" className="text-[var(--color-muted)] hover:text-[var(--color-accent)]">← Boutique</Link>
      <h1 className="font-serif text-3xl text-[var(--color-accent)]">Confidentialité</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Données collectées</h2>
        <p>Pour traiter votre commande, nous enregistrons uniquement :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>votre nom, votre numéro de téléphone et votre quartier ;</li>
          <li>le contenu de votre commande et vos éventuels commentaires ;</li>
          <li>pour une carte cadeau : les coordonnées du destinataire et la photo jointe ;</li>
          <li>
            <strong>votre position, seulement si vous choisissez de la partager</strong> au moment de la commande
            (bouton « Partager ma position »).
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Utilisation</h2>
        <p>
          Ces informations servent uniquement à confirmer votre commande avec vous sur WhatsApp, à préparer et à
          livrer votre commande. Votre position aide le livreur à vous trouver ; elle n&apos;est visible que par la
          boutique et le livreur de votre commande. Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires.
        </p>
        <p>
          Le paiement se fait à la livraison ou au retrait : aucune donnée bancaire n&apos;est collectée sur ce site.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Vos droits</h2>
        <p>
          Vous pouvez demander à consulter, corriger ou supprimer vos informations à tout moment en nous écrivant sur
          WhatsApp.
        </p>
      </section>
    </main>
  );
}

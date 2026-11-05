import { waState } from "./actions";
import { WhatsAppAdmin } from "./WhatsAppAdmin";

export const dynamic = "force-dynamic";

/** Superadmin : instance WhatsApp (SWATS) — création, QR, statut, webhook, test. */
export default async function AdminWhatsAppPage() {
  const initial = await waState();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-fg text-2xl font-extrabold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Alertes Winners et notifications aux abonnés Pro et Business qui ont accepté. Tant que l&apos;envoi réel est
          coupé, toutes les alertes partent par e-mail et notification push.
        </p>
      </div>
      <WhatsAppAdmin initial={initial} />
    </div>
  );
}

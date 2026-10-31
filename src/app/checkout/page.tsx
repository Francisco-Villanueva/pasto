import type { Metadata } from "next";
import { getDb, hasDatabase } from "@/db";
import { loadSettingsFromDb, loadStoreCatalog } from "@/db/catalog";
import { isCheckoutEnabled, parseStoreSettings } from "@/domain/settings";
import { PublicShell } from "@/components/layout/PublicShell";
import { CheckoutForm } from "@/components/store/CheckoutForm";
import { getCustomer } from "@/server/customer-dal";
import { isCustomerLoginEnabled } from "@/server/google";
import { loadAvailableDays, type DayOption } from "@/server/checkout-data";
import { isMapsEnabled, mapsOptionsFromEnv } from "@/server/maps";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

// Los días disponibles dependen de la hora: siempre se calculan al pedir la página.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const catalog = await loadStoreCatalog();
  const account = await getCustomer();

  let days: DayOption[] = [];
  let settings = parseStoreSettings({});
  if (hasDatabase()) {
    const db = await getDb();
    settings = parseStoreSettings(await loadSettingsFromDb(db));
    days = await loadAvailableDays(db, new Date());
  }

  return (
    <PublicShell>
      <CheckoutForm
        catalog={catalog}
        days={days}
        enabled={hasDatabase() && isCheckoutEnabled(settings)}
        mapsEnabled={isMapsEnabled(mapsOptionsFromEnv())}
        storeAddress={settings.storeAddress}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
        account={account ? { email: account.email, name: account.fullName } : null}
        googleEnabled={hasDatabase() && isCustomerLoginEnabled()}
      />
    </PublicShell>
  );
}

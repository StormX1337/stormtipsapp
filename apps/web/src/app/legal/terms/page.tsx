import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Allgemeine Geschäftsbedingungen' };

export default function TermsPage(): ReactNode {
  return (
    <article>
      <h1 className="text-[22px] font-extrabold">Allgemeine Geschäftsbedingungen</h1>
      <p>Stand: laufende Fassung. Es gilt die zum Zeitpunkt des Vertragsschlusses gültige Version.</p>

      <h2>1. Leistungsgegenstand</h2>
      <p>
        PROFIT TIPS stellt redaktionell erstellte Sportanalysen bereit. Die Analysen enthalten
        Wettmarkt, Auswahl, Quote, Buchmacherangabe und eine schriftliche Begründung. Es handelt sich
        um Einschätzungen, nicht um Anlage- oder Rechtsberatung und nicht um eine Wettvermittlung.
      </p>

      <h2>2. Konto</h2>
      <p>
        Für die Nutzung ist ein Konto erforderlich. Du bist für die Geheimhaltung deiner Zugangsdaten
        verantwortlich und musst mindestens 18 Jahre alt sein. Ein Konto darf nicht geteilt werden.
      </p>

      <h2>3. Abonnements und Laufzeit</h2>
      <p>
        Premium-Produkte (VIP, Combo, Extra, Fix Odds) werden als Abonnement mit fester Laufzeit
        angeboten. Sofern nicht anders angegeben, verlängert sich ein Abonnement automatisch um die
        gebuchte Laufzeit, bis es gekündigt wird.
      </p>
      <ul>
        <li>Kündigung über Web: jederzeit im Konto unter „Mein Abo&quot;.</li>
        <li>Kündigung bei Kauf über den App Store: in den iOS-Einstellungen unter Abonnements.</li>
        <li>Kündigung bei Kauf über Google Play: im Play Store unter Abonnements.</li>
      </ul>

      <h2>4. Preise und Zahlung</h2>
      <p>
        Es gelten die zum Kaufzeitpunkt angezeigten Preise inklusive gesetzlicher Umsatzsteuer. Die
        Abrechnung erfolgt über den jeweils gewählten Zahlungsdienstleister.
      </p>

      <h2>5. Widerruf digitaler Inhalte</h2>
      <p>
        Bei digitalen Inhalten erlischt das Widerrufsrecht, sobald mit der Ausführung begonnen wurde
        und du ausdrücklich zugestimmt sowie deine Kenntnis vom Erlöschen bestätigt hast.
      </p>

      <h2>6. Nutzungsrechte</h2>
      <p>
        Inhalte sind ausschließlich für den persönlichen Gebrauch bestimmt. Die Weitergabe,
        Veröffentlichung oder kommerzielle Verwertung von Analysen ist ohne schriftliche Zustimmung
        untersagt.
      </p>

      <h2>7. Haftung</h2>
      <p>
        Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der
        Verletzung des Lebens, des Körpers oder der Gesundheit. Im Übrigen ist die Haftung auf den
        vertragstypischen, vorhersehbaren Schaden begrenzt. Für Wettentscheidungen und deren
        finanzielle Folgen haften wir nicht.
      </p>

      <h2>8. Kündigung durch uns</h2>
      <p>
        Bei Missbrauch, Weitergabe von Inhalten oder Zahlungsverzug können wir das Konto sperren. Ein
        bereits bezahlter, ungenutzter Zeitraum wird in diesem Fall anteilig erstattet.
      </p>
    </article>
  );
}

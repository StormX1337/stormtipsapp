import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Datenschutzerklärung' };

export default function PrivacyPage(): ReactNode {
  return (
    <article>
      <h1 className="text-[22px] font-extrabold">Datenschutzerklärung</h1>

      <h2>Verarbeitete Daten</h2>
      <ul>
        <li>
          <strong>Kontodaten:</strong> E-Mail-Adresse, Anzeigename, Sprache, Zeitzone, Währung,
          Land. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
        </li>
        <li>
          <strong>Zahlungsdaten:</strong> Wir speichern keine Kartendaten. Zahlungen werden von
          Stripe, Apple oder Google abgewickelt; wir speichern lediglich Status, Betrag, Währung und
          die Vorgangs-ID.
        </li>
        <li>
          <strong>Nutzungsdaten:</strong> pseudonyme Produktereignisse (z. B. „paywall_view&quot;)
          ohne IP-Adresse. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).
        </li>
        <li>
          <strong>Push-Token:</strong> nur, wenn du Benachrichtigungen aktivierst.
        </li>
        <li>
          <strong>Sicherheitsdaten:</strong> Sitzungen (IP, User-Agent) zur Missbrauchserkennung.
        </li>
      </ul>

      <h2>Speicherdauer</h2>
      <ul>
        <li>Kontodaten: bis zur Löschung des Kontos.</li>
        <li>Rechnungsdaten: gemäß handels- und steuerrechtlicher Aufbewahrungsfristen.</li>
        <li>Analysedaten: maximal 180 Tage, danach automatisch gelöscht.</li>
        <li>Abgelaufene Sitzungen: automatisch nach 30 Tagen entfernt.</li>
      </ul>

      <h2>Auftragsverarbeiter</h2>
      <p>
        Hosting, E-Mail-Versand, Zahlungsabwicklung (Stripe, Apple, Google) und Push-Zustellung
        (Expo, Firebase, APNs). Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch. Die Löschung deines Kontos kannst du jederzeit selbst
        im Profil auslösen; dabei werden personenbezogene Felder anonymisiert und alle Sitzungen
        widerrufen.
      </p>

      <h2>Sicherheit</h2>
      <p>
        Passwörter werden ausschließlich als Argon2id-Hash gespeichert. Zugriffstoken sind
        kurzlebig; Refresh-Token werden rotiert und nur als Hash gespeichert. Anbieter-API-Schlüssel
        werden mit AES-256-GCM verschlüsselt abgelegt.
      </p>
    </article>
  );
}

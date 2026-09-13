import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Hilfe & Support' };

export default function HelpPage(): ReactNode {
  return (
    <article>
      <h1 className="text-[22px] font-extrabold">Hilfe &amp; Support</h1>

      <h2>Häufige Fragen</h2>

      <h3>Warum sehe ich bei einer Analyse nur Punkte statt der Auswahl?</h3>
      <p>
        Die Analyse gehört zu einem Premium-Produkt. Auswahl, Quote und Begründung werden erst nach
        dem Kauf ausgeliefert — sie verlassen den Server vorher gar nicht.
      </p>

      <h3>Wie werden die Statistiken berechnet?</h3>
      <p>
        Aus abgerechneten Analysen mit einem festen theoretischen Einsatz von einer Einheit. Halbe
        Gewinne und halbe Verluste (Asian-Handicap-Viertellinien) werden korrekt mit dem halben
        Einsatz gewertet, annullierte Wetten mit Faktor 1.
      </p>

      <h3>Mein Kauf wird nicht angezeigt.</h3>
      <p>
        Öffne „Mein Abo&quot; und tippe auf „Wiederherstellen&quot;. Der Server prüft den Kauf erneut
        direkt bei Stripe, Apple oder Google.
      </p>

      <h3>Wie kündige ich?</h3>
      <p>
        Käufe über die Website kündigst du im Konto. Käufe über den App Store oder Google Play müssen
        dort gekündigt werden — das schreiben die Plattformbetreiber vor.
      </p>

      <h3>Wie lösche ich mein Konto?</h3>
      <p>
        Im Profil unter „Konto löschen&quot;. Personenbezogene Felder werden anonymisiert und alle
        Sitzungen sofort widerrufen.
      </p>

      <h2>Kontakt</h2>
      <p>
        Support-Anfragen beantwortet unser Team werktags innerhalb von 24 Stunden. Die
        Kontaktadresse wird vor dem Produktivstart durch die tatsächliche Support-Adresse des
        Betreibers ersetzt.
      </p>
    </article>
  );
}

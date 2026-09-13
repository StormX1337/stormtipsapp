import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Haftungsausschluss' };

export default function DisclaimerPage(): ReactNode {
  return (
    <article>
      <h1 className="text-[22px] font-extrabold">Haftungsausschluss</h1>
      <p>
        Alle Inhalte dienen ausschließlich Informationszwecken. Sportwetten sind mit finanziellem
        Risiko verbunden. Der Ausgang eines Sportereignisses lässt sich nicht sicher vorhersagen.
      </p>

      <h2>Abgrenzung der Kennzahlen</h2>
      <ul>
        <li>
          <strong>Analyse / Tipp:</strong> eine Einschätzung unseres Redaktionsteams vor dem
          Ereignis.
        </li>
        <li>
          <strong>Historische Bilanz:</strong> Ergebnisse bereits abgerechneter Analysen.
        </li>
        <li>
          <strong>Geprüftes Ergebnis:</strong> das über einen Datenanbieter bestätigte Endergebnis
          des Ereignisses.
        </li>
        <li>
          <strong>Theoretischer ROI:</strong> rechnerische Rendite bei einem festen Einsatz je
          Analyse — kein tatsächlich erzielter Gewinn.
        </li>
      </ul>

      <h2>Quoten</h2>
      <p>
        Quoten ändern sich laufend. Die zum Zeitpunkt der Veröffentlichung angegebene Quote kann zum
        Zeitpunkt deiner Wette nicht mehr verfügbar sein. Wir zeigen deshalb sowohl die
        ursprüngliche als auch die aktuelle Quote an.
      </p>

      <h2>Keine Aufforderung</h2>
      <p>
        Die Veröffentlichung einer Analyse stellt keine Aufforderung zur Abgabe einer Wette dar. Jede
        Entscheidung triffst du eigenverantwortlich.
      </p>
    </article>
  );
}

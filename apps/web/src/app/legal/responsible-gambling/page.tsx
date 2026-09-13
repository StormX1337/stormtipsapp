import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Verantwortungsvolles Spielen' };

export default function ResponsibleGamblingPage(): ReactNode {
  return (
    <article>
      <h1 className="text-[22px] font-extrabold">Verantwortungsvolles Spielen</h1>

      <p>
        PROFIT TIPS veröffentlicht Sportanalysen zu Informations- und Unterhaltungszwecken. Wir sind
        kein Buchmacher, nehmen keine Wetten an und verwalten keine Kundengelder.
      </p>

      <h2>Was wir ausdrücklich nicht versprechen</h2>
      <ul>
        <li>Keine garantierten Gewinne.</li>
        <li>Keine „sicheren&quot; oder „risikofreien&quot; Wetten.</li>
        <li>Keine Trefferquote von 100 %.</li>
        <li>Keine Zusage künftiger Ergebnisse auf Basis vergangener Ergebnisse.</li>
      </ul>

      <p>
        Alle in der App gezeigten Kennzahlen (Trefferquote, ROI, Gewinn, Durchschnittsquote) sind
        <strong> geprüfte historische Ergebnisse bereits abgerechneter Analysen</strong>. Sie werden
        mit einem festen theoretischen Einsatz berechnet und sagen nichts über künftige Ergebnisse
        aus.
      </p>

      <h2>Altersgrenze</h2>
      <p>
        Die Nutzung ist Personen ab 18 Jahren vorbehalten. In einzelnen Jurisdiktionen gelten höhere
        Altersgrenzen; es gilt jeweils das Recht deines Wohnsitzlandes.
      </p>

      <h2>Warnzeichen</h2>
      <ul>
        <li>Du setzt Geld ein, das du für laufende Kosten benötigst.</li>
        <li>Du versuchst, Verluste durch höhere Einsätze auszugleichen.</li>
        <li>Du verheimlichst dein Wettverhalten vor Angehörigen.</li>
        <li>Wetten bestimmt deine Stimmung oder deinen Tagesablauf.</li>
      </ul>

      <h2>Hilfe finden</h2>
      <p>
        Wenn Glücksspiel keinen Spaß mehr macht, hole dir Unterstützung. In Deutschland berät die
        Bundeszentrale für gesundheitliche Aufklärung kostenlos und anonym unter der Telefonnummer
        0800 1 37 27 00. In Österreich hilft die Spielsuchthilfe, in der Schweiz „Sucht Schweiz&quot;.
        Eine Liste von Beratungsstellen findest du auf den Seiten der jeweiligen Behörde.
      </p>

      <h2>Selbstschutz</h2>
      <ul>
        <li>Setze dir vorab ein festes Budget und halte dich daran.</li>
        <li>Nutze Einzahlungs- und Verlustlimits bei deinem Buchmacher.</li>
        <li>Mache regelmäßige Pausen und nutze Selbstsperren, wenn nötig.</li>
        <li>Wette nie unter Zeitdruck, Alkohol- oder Substanzeinfluss.</li>
      </ul>
    </article>
  );
}

# PDP Linkbox

Ein Tampermonkey User-Script zur Erweiterung der Otto PDPs (Product Detail Pages) um nützliche Tools und Direktlinks.


## Voraussetzungen

Bevor du die Linkbox installierst, stelle sicher, dass du die Erweiterung Tampermonkey in deinem Browser installiert hast.

* Chrome / Edge / Brave: https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
* Firefox: https://addons.mozilla.org/de/firefox/addon/tampermonkey/


## Einmalige Einrichtung und Installation (Beispiel Chrome)

Hinweis für bestehende Nutzer: Wenn du bereits eine ältere Version der Linkbox installiert hattest, führe bitte Schritt 2 durch, um alte Rückstände zu entfernen.

1. Tampermonkey Plugin installieren: 
   Installiere das Tampermonkey-Browser-Plugin über den oben genannten Link für deinen Browser.

2. (Optional) Alte Version löschen: 
   Falls du die Linkbox bereits installiert hattest: Klicke auf das Tampermonkey-Icon im Browser -> Übersicht -> Alte "pdp.linkbox" löschen.

3. Entwicklermodus aktivieren: 
   Öffne in Chrome die Erweiterungsverwaltung: chrome://extensions (oder über das Menü: Erweiterungen -> Erweiterungen verwalten).
   Aktiviere oben rechts den Schalter "Entwicklermodus".

4. Nutzerscripts zulassen: 
   Klicke in der Erweiterungsverwaltung bei Tampermonkey auf "Details".
   Aktiviere die Option "Nutzerscripts zulassen".

5. PDP Linkbox installieren: 
   Öffne den folgenden Link, um das Skript direkt in Tampermonkey zu installieren:

   https://raw.githubusercontent.com/crassman/pdp-linkbox/main/pdp.linkbox.user.js

   Klicke auf der sich öffnenden Seite auf den Button "Installieren" bzw. "Neu installieren".

6. Domain-Freigabe auf otto.de: 
   Rufe eine beliebige Produktdetailseite auf otto.de/p/* auf.
   Wenn Tampermonkey nach Berechtigungen fragt, klicke auf "Diese Domain immer zulassen".

---

## Saleability-Anzeige

Ganz oben in der Linkbox zeigt ein Badge, ob die Variation aktuell **saleable** ist, also für OTTO-Kunden sowohl auffindbar (discoverable) als auch kaufbar (purchasable). Die Werte stammen aus `status.saleability` der Variation-API, darunter steht der Zeitpunkt der letzten Änderung (`updated`).

* **✓ saleable** (grün): Alles in Ordnung, es werden keine weiteren Details angezeigt.
* **✗ saleable** (rot): Darunter erscheint ein Ursachenbaum mit den Teilen, die nicht erfüllt sind.

Beispiel:

```
Saleability:  ✗ saleable ⓘ
  └ ✗ nicht purchasable ⓘ
      └ availability.state = SOLDOUT (stock: 0, seit 9. November 2026 um 13:33:02 MEZ)
```

Die Ursachen werden aus den Rohdaten der Variation-API abgeleitet:

| Nicht erfüllt | Geprüfte Ursachen |
|---|---|
| discoverable | `status.onlineRelevance` ist nicht `ACTIVE` · `status.displayRestriction` ist gesetzt (`EXCLUDENAVIGATION`/`EXCLUDESEARCH`, ausgelöst durch eine Permission mit Status `RESTRICTED`) · Offer vorhanden und `offering.onlineRelevance` ist nicht `ACTIVE` |
| purchasable | `status.onlineRelevance` ist nicht `ACTIVE` · `availability.state` ist `SOLDOUT` (inkl. Bestand und Zeitpunkt) |

Greift keine dieser Regeln, erscheint der Hinweis „Ursache nicht ableitbar – ggf. Daten noch nicht synchron“. Die Rohdaten werden zu anderen Zeitpunkten aktualisiert als die Saleability, daher kann es kurzzeitig Abweichungen geben.

Fährt man mit der Maus über das **ⓘ**, erscheint die Definition von saleable, discoverable bzw. purchasable.

Hinweis: Die Anzeige setzt eine erreichbare Variation-API voraus (VPN / OTTO-Netz). Sie gibt den Stand beim Laden der Seite bzw. beim Variantenwechsel wieder und aktualisiert sich nicht live.

---

## Updates

Das Skript aktualisiert sich automatisch über GitHub. Du musst nach der Ersteinrichtung nichts weiter tun. Stelle im Zweifel nur sicher, dass automatische Updates erlaubt sind.

---

## Kontakt und Support

Bei Fragen, Bugs oder Feature-Wünschen:
* Autor: Christian Raßmann (christian.rassmann@otto.de)
* Issues: https://github.com/crassman/pdp-linkbox/issues

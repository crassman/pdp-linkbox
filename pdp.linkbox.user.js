// ==UserScript==
// @name        pdp.linkbox
// @namespace   https://*.otto.de/
// @version     6.3
// @description Adds a Linkbox to otto.de PDP
// @author      christian.rassmann@otto.de
// @match       https://*.otto.de/p/*
// @grant       GM.xmlHttpRequest
// @downloadURL https://github.com/crassman/pdp-linkbox/main/pdp.linkbox.user.js
// @updateURL   https://github.com/crassman/pdp-linkbox/main/pdp.linkbox.user.js
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @connect     variation-api.live.opal.cloud.otto.de
// @connect     *.opal.cloud.otto.de
// @connect     *.otto.de
// ==/UserScript==

(function () {
    'use strict';

    // ─── Konstanten ───────────────────────────────────────────────────────────

    const VERSION          = '6.3';
    const POLLING_INTERVAL = 1000;
    const VAR_API_BASE     = 'https://variation-api.live.opal.cloud.otto.de/opal-variation-api/variations';
    const LOG_PREFIX       = '[Linkbox]';

    // Attribut-Name, der den aktuellen Render-Zustand der Box speichert
    const LINKBOX_STATE_ATTR = 'data-linkbox-state';

    // ─── State ────────────────────────────────────────────────────────────────

    let lastKnownUrl = window.location.href;
    let pdpObserver  = null;
    let isRunning    = false;
    let pending      = false;

    // ─── Logging ──────────────────────────────────────────────────────────────

    const log   = (...args) => console.log(LOG_PREFIX,   ...args);
    const error = (...args) => console.error(LOG_PREFIX, ...args);

    // ─── Hilfsfunktionen ──────────────────────────────────────────────────────

    /**
     * Liest URL-Parameter aus einem Query-String in ein Objekt.
     */
    function parseQueryString(queryString) {
        const params = {};
        if (!queryString) return params;
        try {
            new URLSearchParams(queryString).forEach((value, key) => {
                params[key] = value;
            });
        } catch (e) {
            error('Fehler beim Parsen des Query-Strings:', queryString, e);
        }
        return params;
    }

    /**
     * Extrahiert die variationId aus Query- oder Hash-Parametern der aktuellen URL.
     */
    function extractVariationIdFromUrl(url) {
        try {
            const parsed = new URL(url);
            return (
                parsed.searchParams.get('variationId') ||
                new URLSearchParams(parsed.hash.replace(/^#/, '')).get('variationId') ||
                null
            );
        } catch (e) {
            error('Ungültige URL:', url, e);
            return null;
        }
    }

    /**
     * Formatiert einen ISO-Datumsstring in deutsches Format.
     */
    function formatDate(isoString) {
        if (!isoString) return '–';
        try {
            return new Date(isoString).toLocaleDateString('de-DE', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZoneName: 'short',
            });
        } catch (e) {
            return isoString;
        }
    }

    // ─── Complaint-Tool-Daten ─────────────────────────────────────────────────

    /**
     * Liest die Complaint-URL aus dem DOM.
     *
     * Unterstützt zwei Strukturvarianten:
     *   NEU: base64-href am <oc-link-v2> innerhalb von .js_pdp_complaint-tool
     *   ALT: data-complaint-url am .js_pdp_complaint-tool selbst
     *
     * Gibt absolute URL zurück (window.location.origin als Basis).
     */
    function extractComplaintToolData() {
        const container = document.querySelector('.js_pdp_complaint-tool');
        if (!container) return null;

        const linkEl       = container.querySelector('oc-link-v2[base64-href]');
        const rawBase64New = linkEl?.getAttribute('base64-href');
        const rawBase64Old = container.getAttribute('data-complaint-url');
        const rawBase64    = rawBase64New || rawBase64Old;

        if (!rawBase64) return null;

        try {
            const decoded = atob(rawBase64);

            // Fix #2: window.location.origin statt hardcoded https://www.otto.de
            const absoluteUrl = decoded.startsWith('http')
                ? decoded
                : new URL(decoded, window.location.origin).toString();

            const parsed = new URL(absoluteUrl);
            const params = parseQueryString(parsed.search.substring(1));

            // Fix #2: absoluteUrl zurückgeben, nicht decoded
            return { decodedComplaintToolUrl: absoluteUrl, params };
        } catch (e) {
            error('Fehler beim Decodieren der Complaint-URL:', e);
            return null;
        }
    }

    /**
     * Gibt true zurück, sobald das Complaint-Tool-Element mit Daten im DOM ist.
     */
    function isComplaintToolReady() {
        const container = document.querySelector('.js_pdp_complaint-tool');
        if (!container) return false;
        return (
            container.hasAttribute('data-complaint-url') ||       // alt
            !!container.querySelector('oc-link-v2[base64-href]')  // neu
        );
    }

    // ─── API ──────────────────────────────────────────────────────────────────

    /**
     * Führt einen GM.xmlHttpRequest als Promise durch.
     */
    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method:  'GET',
                url,
                timeout: 15000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch (e) {
                            reject(new Error('Ungültige JSON-Antwort.'));
                        }
                    } else {
                        reject(new Error(`HTTP-Fehler: ${res.status}`));
                    }
                },
                onerror:   (res) => reject(new Error(
                    `Netzwerkfehler: status=${res.status ?? '–'} ${res.statusText ?? ''} url=${res.finalUrl ?? url}`
                )),
                ontimeout: () => reject(new Error('Request Timeout')),
            });
        });
    }

    /**
     * Lädt Variation-API-Daten und gibt ein normalisiertes Objekt zurück.
     */
    async function fetchVariationData(variationId) {
        const url = `${VAR_API_BASE}/${variationId}?origin=plugin`;
        log(`Lade Variation-Daten für "${variationId}" …`);
        const obj = await gmFetch(url);

        return {
            variationId,
            gtin:               obj.gtin                                              || '',
            productId:          obj.products?.productId                               || '',
            businessModelValue: obj.partnerSpecifications?.businessModel?.value       || '',
            businessModelGroup: obj.partnerSpecifications?.businessModel?.group       || '',
            categoryValue:      obj.businessCategory?.value                           || '',
            categorySub:        obj.businessCategory?.sub                             || '',
            retailerId:         obj.partnerSpecifications?.retailer?.id               || '',
            retailerName:       obj.partnerSpecifications?.retailer?.name             || '',
            supplierId:         obj.partnerSpecifications?.supplier?.id               || '',
            supplierName:       obj.partnerSpecifications?.supplier?.value            || '',
            assortmentCode:     obj.partnerSpecifications?.assortmentCode?.value      || '',
            assortmentType:     obj.partnerSpecifications?.assortmentCode?.type       || '',
            lastModified:       formatDate(obj.lastModified),
            offerId:            obj.offering?.offerId                                 || null,
            offerStrategy:      obj.offering?.strategy                                || null,
            offerCount:         obj.offering?.count                                   ?? null,
            useContent:         obj.offering?.useContent                              ?? null,
        };
    }

    // ─── Linkbox HTML ─────────────────────────────────────────────────────────

    /**
     * Rendert die Linkbox und injiziert sie in <body>.
     *
     * @param {object|null} complaintData  - Ergebnis von extractComplaintToolData()
     * @param {object}      varData        - Variation-API-Daten (oder {})
     * @param {'loading'|'error'|'ready'|'minimal'} state
     */
    function renderLinkbox(complaintData, varData = {}, state = 'minimal') {
        $('#Linkbox').remove();

        const params              = complaintData?.params || {};
        const decodedComplaintUrl = complaintData?.decodedComplaintToolUrl || null;

        const {
            variationId = '', productId = '', gtin = '',
            businessModelValue = '', businessModelGroup = '',
            categoryValue = '', categorySub = '',
            supplierId = '', supplierName = '',
            assortmentCode = '', assortmentType = '',
            lastModified = '',
            offerId = null, offerStrategy = null, offerCount = null, useContent = null,
        } = varData;

        const effectiveProductId   = productId || params.contentProductId || '';
        const effectiveVariationId = variationId || params.conditionVariationId || params.contentVariationId || '';
        const isOttoFirstParty     = (
            businessModelValue === 'OTTO' ||
            businessModelValue === 'CROSSSELLING' ||
            params.contentRetailerId === '1000000'
        );

        // ── Status-Banner ─────────────────────────────────────────────────────
        // Netzwerkfehler-Banner nennt explizit VPN
        const statusBanner = {
            loading: `<div style="color:orange;border:1px dashed orange;padding:5px;margin-top:10px;">
                        <strong>Lädt …</strong> Variation-API wird abgefragt.
                      </div>`,
            error:   `<div style="color:red;border:1px solid red;padding:5px;margin-top:10px;">
                        <strong>Netzwerkfehler:</strong> Variation-API nicht erreichbar.
                        Bitte VPN / OTTO-Netz prüfen.
                      </div>`,
            ready:   '',
            minimal: '',
        }[state] ?? '';

        // ── Complaint-Tool-Block ──────────────────────────────────────────────
        const complaintBlock = decodedComplaintUrl ? `
            <span><a href="${decodedComplaintUrl}" target="_blank">Complaint-Tool-URL</a></span><br>
            <span>conditionProductId: <b>${params.conditionProductId || '–'}</b></span><br>
            <span>conditionVariationId:
                <a style="text-decoration:none" target="_blank"
                   href="${VAR_API_BASE}/${params.conditionVariationId || ''}?origin=plugin">
                    <b>${params.conditionVariationId || '–'}</b>
                </a>
            </span><br>
            <span>contentProductId: <b>${params.contentProductId || '–'}</b></span><br>
            <span>contentVariationId:
                <a style="text-decoration:none" target="_blank"
                   href="${VAR_API_BASE}/${params.contentVariationId || ''}?origin=plugin">
                    <b>${params.contentVariationId || '–'}</b>
                </a>
            </span><br><br>
            <span>contentRetailerId: <b>${params.contentRetailerId || '–'}</b></span><br>
            <span>contentRetailerName: <b>${params.contentRetailerName || '–'}</b></span>
        ` : '<span style="color:#999;">Complaint-Tool-Daten nicht verfügbar.</span>';

        // ── Variation-API-Block ───────────────────────────────────────────────
        const variationBlock = productId ? `
            <hr style="margin:8px 0;border:none;border-top:1px solid #E6E6E6;">
            <span>productId: <b>${productId}</b></span><br>
            <span>variationId: <b>${variationId}</b></span><br>
            <span>Model: <b>${businessModelValue}</b> (${businessModelGroup})</span><br>
            <span>Category: <b>${categorySub}</b> (${categoryValue})</span><br>
            <span>Supplier: <b>${supplierId}</b> (${supplierName})</span><br>
            <span>GTIN: <b>${gtin}</b></span><br>
            <span>Assortment: <b>${assortmentType}</b> (${assortmentCode})</span>
        ` : '';

        // ── First-Party-Links ─────────────────────────────────────────────────
        const firstPartyBlock = (isOttoFirstParty && effectiveProductId) ? `
            <hr style="margin:8px 0;border:none;border-top:1px solid #E6E6E6;">
            <a href="https://primary.retail-connect.otto.de/produktdatenpflege/${effectiveProductId}" target="_blank">PRIMARY Produktdatenpflege</a><br>
            Assets:
            <a href="https://assetmanager.prod.contentfac2ry.services/ui/bs/${effectiveProductId}" target="_blank">MAS</a> /
            <a href="https://s-a-m.otto.de/browser/assets?sq_q=${effectiveProductId}" target="_blank">S-A-M</a><br>
            <a href="https://orbit.retail-connect.otto.de/?q=${effectiveProductId}&t=PCK" target="_blank">ORBIT</a><br>
            <a href="https://productcockpit.retail-connect.otto.de/?q=${effectiveProductId}" target="_blank">ProductCockpit</a>
        ` : '';

        // ── Variation-API-Link + Offering ─────────────────────────────────────
        const apiBlock = effectiveVariationId ? `
            <hr style="margin:8px 0;border:none;border-top:1px solid #E6E6E6;">
            <a href="${VAR_API_BASE}/${effectiveVariationId}?origin=plugin" target="_blank">PDH Variation-API</a>
            ${offerId ? `
                <br><br>
                <b><a href="https://offering.live.opal.cloud.otto.de/opal-offering/howto" target="_blank">Offering</a></b> (How to)<br>
                OfferId: <b><a href="https://internal.otto.market/offer-explorer/offer/${offerId}/" target="_blank">${offerId}</a></b> (${offerStrategy})<br>
                offerCount: <b>${offerCount}</b><br>
                useContent: <b>${useContent}</b>
            ` : ''}
            <br><br><small style="color:#888;">lastModified: ${lastModified || '–'}</small>
        ` : '';

        // ── Zusammenbauen ─────────────────────────────────────────────────────
        const html = `
            <div id="Linkbox"
                 ${LINKBOX_STATE_ATTR}="${state}"
                 style="
                    background:#fff; top:15px; right:15px; position:fixed; z-index:9999;
                    width:335px; padding:15px; border-radius:2px; border:2px solid #E6E6E6;
                    font-size:0.9em; line-height:normal; box-shadow:0 4px 8px rgba(0,0,0,0.1);
                    max-height:90vh; overflow-y:auto;
                ">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <h3 style="margin:0;"><b>Linkbox</b> <small style="color:#0079C1;">v${VERSION}</small></h3>
                    <button id="LinkboxClose" style="
                        background:none;border:none;cursor:pointer;font-size:1em;
                        color:#888;padding:0 2px;line-height:1;
                    " title="Schließen">✕</button>
                </div>
                ${complaintBlock}
                ${statusBanner}
                ${variationBlock}
                ${firstPartyBlock}
                ${apiBlock}
            </div>
        `;

        $('body').prepend(html);
        $('#LinkboxClose').on('click', () => $('#Linkbox').remove());
    }

    // ─── Kern-Logik ───────────────────────────────────────────────────────────

    /**
     * Führt den gesamten Ablauf durch:
     * 1. Sofortige Anzeige mit vorhandenen Daten
     * 2. Asynchrone Anreicherung via Variation-API
     *
     * pending-Flag sorgt dafür, dass ein während des API-Calls
     * eintreffendes URL-Update nicht verloren geht (trailing-edge rerun).
     */
    async function runLinkboxLogic() {
        if (isRunning) {
            pending = true;
            return;
        }
        isRunning = true;

        try {
            const variationIdFromUrl   = extractVariationIdFromUrl(window.location.href);
            const complaintData        = extractComplaintToolData();
            const variationIdFromComp  = complaintData?.params.conditionVariationId
                                       || complaintData?.params.contentVariationId
                                       || null;
            const effectiveVariationId = variationIdFromUrl || variationIdFromComp;

            log('variationId (URL):', variationIdFromUrl);
            log('variationId (Complaint):', variationIdFromComp);
            log('effectiveVariationId:', effectiveVariationId || 'keiner');
            if (complaintData) log('Complaint-Tool-Daten extrahiert:', complaintData.params);

            if (!complaintData && !effectiveVariationId) {
                log('Keine ausreichenden Daten – warte auf Observer.');
                return;
            }

            // Sofort rendern
            const initialState = effectiveVariationId ? 'loading' : 'minimal';
            renderLinkbox(complaintData, {}, initialState);

            // API-Daten nachladen
            if (effectiveVariationId) {
                try {
                    const varData = await fetchVariationData(effectiveVariationId);
                    log('Variation-Daten geladen:', varData);
                    renderLinkbox(complaintData, varData, 'ready');
                    pdpObserver?.disconnect(); // Observer nicht mehr nötig
                    log('Observer getrennt (state: ready).');
                } catch (e) {
                    error('Variation-API-Fehler:', e.message);
                    renderLinkbox(complaintData, {}, 'error');
                    pdpObserver?.disconnect(); // Auch bei Fehler nicht weiter beobachten
                    log('Observer getrennt (state: error).');
                }
            }
        } finally {
            isRunning = false;
            // Falls währenddessen ein Update anstand, jetzt nachholen
            if (pending) {
                pending = false;
                runLinkboxLogic();
            }
        }
    }

    // ─── Observer & Polling ───────────────────────────────────────────────────

    /**
     * MutationObserver: wartet auf das Complaint-Tool-Element im DOM.
     */
    function observePDP() {
        // Initialer Check
        if (isComplaintToolReady()) {
            log('Complaint-Tool sofort verfügbar.');
            runLinkboxLogic();
        } else if (extractVariationIdFromUrl(window.location.href)) {
            runLinkboxLogic();
        }

        pdpObserver = new MutationObserver(() => {
            if (!isComplaintToolReady()) return;

            // Rerun wenn Box fehlt oder noch ohne Complaint-Daten (state=minimal)
            const existingBox   = document.getElementById('Linkbox');
            const existingState = existingBox?.getAttribute(LINKBOX_STATE_ATTR);
            const hasComplaint  = !!extractComplaintToolData()?.decodedComplaintToolUrl;

            if (!existingBox || (hasComplaint && existingState === 'minimal')) {
                log('Complaint-Tool via Observer – Box wird aktualisiert (state war:', existingState ?? 'none', ')');
                runLinkboxLogic();
            }
        });

        pdpObserver.observe(document.body, {
            childList:       true,
            subtree:         true,
            attributes:      true,
            attributeFilter: ['data-complaint-url', 'base64-href'],
        });
    }

    /**
     * URL-Überwachung: history-Hook (sofortig) + Polling als Safety-Net.
     */
    function startUrlPolling() {
        // SPA-Navigation via history API abfangen
        const patchHistory = (method) => {
            const original = history[method];
            history[method] = function (...args) {
                original.apply(this, args);
                const newUrl = window.location.href;
                if (newUrl !== lastKnownUrl) {
                    log(`history.${method} erkannt:`, newUrl);
                    lastKnownUrl = newUrl;
                    runLinkboxLogic();
                }
            };
        };
        patchHistory('pushState');
        patchHistory('replaceState');

        // Polling als Safety-Net
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastKnownUrl) {
                log('URL-Änderung (Polling) erkannt:', currentUrl);
                lastKnownUrl = currentUrl;
                runLinkboxLogic();
            }
        }, POLLING_INTERVAL);
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    $(document).ready(function () {
        log(`Gestartet (v${VERSION}).`);

        observePDP();
        startUrlPolling();

        $(window).on('hashchange', () => {
            log('Hash-Änderung erkannt.');
            runLinkboxLogic();
        });
    });

})();
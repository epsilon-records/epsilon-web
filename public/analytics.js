// Manual public-site beacon only. This is an MPA; never reuse this loader in an authenticated app.
(() => {
  "use strict";
  try {
    // Public client identifier, NOT an API credential. Empty string disables all vendor requests.
    // Manual site f9f78482b527488da5ab5c2b80d0a2df; auto_install:false verified by configuration owner.
    const token = "0b223235447e41789bb83dc363ad6611";
    if (!/^[a-f0-9]{32}$/i.test(token || "")) return;

    // Explicit public content routes, not a prefix rule. Review additions for URL exposure.
    const paths = new Set([
      "/", "/about/", "/contact/", "/erms/", "/labelkit/", "/audiokit/", "/epsilon-audio/",
      "/nieuwe-groove-collectief/", "/diverse-records/", "/collective/", "/partners/", "/anr-guide/",
    ]);
    const clean = (raw, local) => {
      if (typeof raw !== "string" || !raw || /[?#]/.test(raw)) return false;
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password) return false;
      // Also exclude sensitive/unknown external referrers: only root or known content paths.
      if (!paths.has(url.pathname)) return false;
      return !local || url.origin === "https://epsilonrecords.com";
    };
    if (!clean(location.href, true)) return;
    const navigation = performance.getEntriesByType("navigation");
    if (navigation.length !== 1 || !clean(navigation[0].name, true)) return;
    if (typeof document.referrer !== "string") return;
    if (document.referrer !== "" && !clean(document.referrer, false)) return;
    if (window.__epsilonAnalyticsInstalled || document.querySelector(
      'script[data-cf-beacon], script[src*="cloudflareinsights.com/"]',
    )) return;

    const beacon = document.createElement("script");
    beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
    beacon.defer = true;
    beacon.referrerPolicy = "no-referrer";
    beacon.setAttribute("data-cf-beacon", JSON.stringify({ token, spa: false }));
    window.__epsilonAnalyticsInstalled = true;
    document.head.append(beacon);
  } catch {
    // Missing/unknown browser context must never enable collection.
  }
})();

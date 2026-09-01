import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

// Global safeguard: wrap Object.values to return [] when called with null/undefined
try {
  const _origValues = Object.values;
  Object.values = function (obj) {
    if (obj === null || obj === undefined) {
      // eslint-disable-next-line no-console
      const stack = new Error().stack;
      console.error("Object.values called with null/undefined", obj, stack);
      try {
        const recent = window.__RECENT_REACT_ELEMENTS || [];
        const simplify = (el) => {
          try {
            const p = el.props || {};
            const keys = Object.keys(p || {}).slice(0, 10);
            const preview = {};
            keys.forEach(k => {
              const v = p[k];
              if (v === null || v === undefined) preview[k] = v;
              else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') preview[k] = String(v).slice(0, 200);
              else if (Array.isArray(v)) preview[k] = `[array:${v.length}]`;
              else if (typeof v === 'object') preview[k] = `{object:${Object.keys(v||{}).length}}`;
              else preview[k] = typeof v;
            });
            return { name: el.name, propsKeys: keys, propsPreview: preview, time: el.time };
          } catch (e) { return { name: el.name || 'Unknown' }; }
        };
        const recentSimple = recent.slice(0, 50).map(simplify);
        window.__LAST_VALUES_CALL = { time: Date.now(), arg: obj, stack, recentSimple };
        // eslint-disable-next-line no-console
        console.error("Object.values NULL call snapshot:", JSON.stringify(window.__LAST_VALUES_CALL, null, 2));
      } catch (e) {
        // ignore
      }
      return [];
    }
    return _origValues.call(Object, obj);
  };
} catch (e) {
  // ignore
}

// Instrument React.createElement to capture recent elements and props (keeps a small ring buffer)
try {
  const origCreate = React.createElement;
  const MAX_RECENT = 50;
  window.__RECENT_REACT_ELEMENTS = window.__RECENT_REACT_ELEMENTS || [];
  React.createElement = function (type, props, ...children) {
    try {
      const name = typeof type === 'string' ? type : (type && (type.displayName || type.name)) || 'Unknown';
      const snapshot = { name, props: props || {}, time: Date.now() };
      window.__RECENT_REACT_ELEMENTS.unshift(snapshot);
      if (window.__RECENT_REACT_ELEMENTS.length > MAX_RECENT) window.__RECENT_REACT_ELEMENTS.length = MAX_RECENT;
    } catch (e) {
      // ignore
    }
    return origCreate.call(React, type, props, ...children);
  };
} catch (e) {
  // ignore
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for offline support
serviceWorkerRegistration.register();

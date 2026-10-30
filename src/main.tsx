import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { prepareAssets } from "./ws/assets";
import "./index.css";

// The icons of the cached layout are read from the device database first, so the first draw already has them.
void prepareAssets().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

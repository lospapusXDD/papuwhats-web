import React from "react";
import ReactDOM from "react-dom/client";
import { PapuRoot } from "@/components/papu/app";
import "./styles.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PapuRoot />
    </React.StrictMode>
  );
}

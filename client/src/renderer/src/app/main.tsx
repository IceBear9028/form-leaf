import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MarkdownPrototype } from "../pages/document-editor/MarkdownPrototype";
import "./global.css";
import "../pages/document-editor/preview/resumeDocument.css";

const content = window.location.hash === "#markdown-prototype"
  ? <MarkdownPrototype />
  : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);

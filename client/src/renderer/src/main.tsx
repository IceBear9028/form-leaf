import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MarkdownPrototype } from "./components/MarkdownPrototype";
import "./styles/app.css";
import "./styles/resume.css";

const content = window.location.hash === "#markdown-prototype"
  ? <MarkdownPrototype />
  : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {content}
  </React.StrictMode>,
);

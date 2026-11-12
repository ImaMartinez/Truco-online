import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EntryApp } from "./EntryApp";
import "./styles.css";
import "./components/cards/cards.css";
import "./components/battlefield.css";
import './profile.css';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EntryApp />
  </StrictMode>,
);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("MAIN_TSX_START");

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Renderer root element not found");
} else {
  console.log("BEFORE_RENDER");
  try {
    createRoot(rootElement).render(<App />);
  } catch (error) {
    console.error("Renderer render failed", error);
  }
}

import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";

console.log("MAIN_TSX_START");

document.documentElement.classList.add("dark");

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Renderer root element not found");
} else {
  console.log("BEFORE_RENDER");
  try {
    createRoot(rootElement).render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
  } catch (error) {
    console.error("Renderer render failed", error);
  }
}

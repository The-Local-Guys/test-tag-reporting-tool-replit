import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("hello world");

createRoot(document.getElementById("root")!).render(<App />);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.tsx";
import "./index.css";

//------------------------------
// Authentication Setup
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports.js";

Amplify.configure(awsExports);
//------------------------------


const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
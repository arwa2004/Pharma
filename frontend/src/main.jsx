import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App.jsx";
import { SoutenanceProvider } from "./context/SoutenanceContext.jsx";

// Thème médical clair, moderne et lisible
const theme = createTheme({
  palette: {
    primary: { main: "#065f46" }, // Vert émeraude médical
    secondary: { main: "#2563eb" },
    background: { default: "#f8fafc" },
  },
  typography: {
    fontSize: 14.5,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    h4: { fontSize: "1.5rem", fontWeight: 700 },
    h5: { fontSize: "1.3rem", fontWeight: 700 },
    h6: { fontSize: "1.1rem", fontWeight: 600 },
    subtitle1: { fontSize: "1rem" },
    subtitle2: { fontSize: "0.92rem", fontWeight: 600 },
    body1: { fontSize: "0.95rem" },
    body2: { fontSize: "0.88rem" },
    button: { fontSize: "0.88rem", textTransform: "none", fontWeight: 600 },
    caption: { fontSize: "0.8rem" },
  },
  components: {
    MuiButton: {
      defaultProps: { size: "medium" },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: "0.88rem",
          padding: "10px 14px",
        },
        head: {
          fontWeight: 700,
          fontSize: "0.82rem",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: "0.8rem",
          height: 26,
        },
      },
    },
  },
  shape: { borderRadius: 10 },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SoutenanceProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SoutenanceProvider>
    </ThemeProvider>
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App.jsx";

// Thème avec typographie compacte et soignée
const theme = createTheme({
  palette: {
    primary: { main: "#2f7377" },
    background: { default: "#f1f7f7" },
  },
  typography: {
    fontSize: 13,
    htmlFontSize: 16,
    h4: { fontSize: "1.25rem", fontWeight: 700 },
    h5: { fontSize: "1.1rem", fontWeight: 600 },
    h6: { fontSize: "0.95rem", fontWeight: 600 },
    subtitle1: { fontSize: "0.88rem" },
    subtitle2: { fontSize: "0.82rem" },
    body1: { fontSize: "0.84rem" },
    body2: { fontSize: "0.78rem" },
    button: { fontSize: "0.8rem", textTransform: "none", fontWeight: 500 },
    caption: { fontSize: "0.72rem" },
  },
  components: {
    MuiButton: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 6,
          fontSize: "0.78rem",
          padding: "4px 10px",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          "& .MuiInputBase-input": {
            fontSize: "0.82rem",
            padding: "6px 10px",
          },
          "& .MuiInputLabel-root": {
            fontSize: "0.82rem",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "6px 10px",
          fontSize: "0.8rem",
        },
        head: {
          fontWeight: 600,
          fontSize: "0.8rem",
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: "small",
      },
      styleOverrides: {
        root: {
          fontSize: "0.72rem",
          height: 22,
        },
      },
    },
  },
  shape: { borderRadius: 8 },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

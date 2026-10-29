import { useState } from "react";
import { Box, Button, Chip, Collapse, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

export default function SparqlBox({ sparql, defaultOpen = false }) {
  const [ouvert, setOuvert] = useState(defaultOpen);
  const [copie, setCopie] = useState(false);

  if (!sparql) return null;

  const copier = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sparql);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2.5,
        border: "1px solid #cbd5e1",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#ffffff",
      }}
    >
      <Box
        onClick={() => setOuvert(!ouvert)}
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          bgcolor: ouvert ? "#f8fafc" : "#ffffff",
          borderBottom: ouvert ? "1px solid #e2e8f0" : "none",
          transition: "background-color 0.2s",
          "&:hover": { bgcolor: "#f1f5f9" },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CodeIcon sx={{ color: "#065f46", fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>
            Dernière requête SPARQL exécutée (Apache Jena Fuseki)
          </Typography>
          <Chip label="SPARQL 1.1" size="small" sx={{ height: 20, fontSize: "0.68rem", bgcolor: "#ecfdf5", color: "#065f46", fontWeight: 600 }} />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={copie ? "Copié !" : "Copier la requête"}>
            <IconButton size="small" onClick={copier} sx={{ color: copie ? "#10b981" : "#64748b" }}>
              {copie ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            endIcon={ouvert ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ fontSize: "0.75rem", textTransform: "none", color: "#64748b" }}
          >
            {ouvert ? "Masquer" : "Afficher le code"}
          </Button>
        </Stack>
      </Box>

      <Collapse in={ouvert}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            bgcolor: "#0f172a",
            color: "#e2e8f0",
            fontSize: "0.78rem",
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: 1.5,
            overflowX: "auto",
            maxHeight: 280,
            whiteSpace: "pre-wrap",
          }}
        >
          {sparql}
        </Box>
      </Collapse>
    </Paper>
  );
}

import { useState } from "react";
import { Box, Button, Chip, Collapse, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useSoutenance } from "../context/SoutenanceContext.jsx";

export default function SparqlBox({ sparql, defaultOpen = false, forceShow = false }) {
  const { modeSoutenance } = useSoutenance();
  const [ouvert, setOuvert] = useState(defaultOpen);
  const [copie, setCopie] = useState(false);

  // Si le mode soutenance est inactif et qu'on ne force pas l'affichage,
  // on masque le bloc pour ne pas encombrer l'écran.
  if (!sparql) return null;
  if (!modeSoutenance && !forceShow) return null;

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
        mt: 3,
        border: "1px solid #cbd5e1",
        borderRadius: 2.5,
        overflow: "hidden",
        bgcolor: "#ffffff",
      }}
    >
      <Box
        onClick={() => setOuvert(!ouvert)}
        sx={{
          px: 2.5,
          py: 1.5,
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
          <CodeIcon sx={{ color: "#065f46", fontSize: 22 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
            Requête SPARQL exécutée (Apache Jena Fuseki)
          </Typography>
          <Chip label="SPARQL 1.1" size="small" sx={{ height: 22, fontSize: "0.72rem", bgcolor: "#ecfdf5", color: "#065f46", fontWeight: 700 }} />
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
            sx={{ fontSize: "0.82rem", textTransform: "none", color: "#475569", fontWeight: 600 }}
          >
            {ouvert ? "Masquer" : "Voir la requête"}
          </Button>
        </Stack>
      </Box>

      <Collapse in={ouvert}>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2.5,
            bgcolor: "#0f172a",
            color: "#e2e8f0",
            fontSize: "0.84rem",
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: 1.6,
            overflowX: "auto",
            maxHeight: 320,
            whiteSpace: "pre-wrap",
          }}
        >
          {sparql}
        </Box>
      </Collapse>
    </Paper>
  );
}

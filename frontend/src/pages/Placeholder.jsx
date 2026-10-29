import { Paper, Typography } from "@mui/material";

// Page temporaire : chaque membre la remplace par sa vraie page.
export default function Placeholder({ titre }) {
  return (
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom fontWeight="bold">{titre}</Typography>
      <Typography variant="body2" color="text.secondary">
        Module en cours d'intégration dans l'ontologie partagée.
      </Typography>
    </Paper>
  );
}

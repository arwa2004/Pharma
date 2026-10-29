import { Link, Outlet, useLocation } from "react-router-dom";
import {
  AppBar, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Stack, Chip
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import MedicationIcon from "@mui/icons-material/Medication";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";

const LARGEUR_MENU = 225;

const MENU = [
  { chemin: "/patients", titre: "Patients", icon: <PeopleIcon /> },
  { chemin: "/pathologies", titre: "Maladies", icon: <LocalHospitalIcon /> },
  { chemin: "/medicaments", titre: "Médicaments", icon: <MedicationIcon /> },
  { chemin: "/risques", titre: "Risques des médicaments", icon: <WarningAmberIcon /> },
  { chemin: "/prescriptions", titre: "Prescriptions", icon: <AssignmentIcon /> },
  { chemin: "/assistant", titre: "Assistant NLP", icon: <SmartToyIcon /> },
];

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <Box sx={{ display: "flex", bgcolor: "#f8fafc", minHeight: "100vh" }}>
      {/* Barre supérieure */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: "#065f46",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: 56, px: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LocalHospitalIcon />
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: "1.15rem", letterSpacing: -0.3 }}>
              Pharma-Santé
            </Typography>
            <Chip
              label="Espace Patients"
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "#fff", fontSize: "0.78rem", height: 24, fontWeight: 600 }}
            />
          </Stack>

          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
            Ontologie OWL · SPARQL 1.1 · spaCy NLP
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Menu latéral */}
      <Drawer
        variant="permanent"
        sx={{
          width: LARGEUR_MENU,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: LARGEUR_MENU,
            boxSizing: "border-box",
            bgcolor: "#064e3b",
            color: "#ecfdf5",
          },
        }}
      >
        <Toolbar sx={{ minHeight: 56 }} />
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="caption" sx={{ color: "#a7f3d0", fontWeight: 700, letterSpacing: 0.8, fontSize: "0.72rem" }}>
            MENU PRINCIPAL
          </Typography>
        </Box>
        <List sx={{ px: 1.5, py: 0 }}>
          {MENU.map((m) => {
            const actif = pathname === m.chemin || pathname.startsWith(m.chemin + "/");
            return (
              <ListItemButton
                key={m.chemin}
                component={Link}
                to={m.chemin}
                selected={actif}
                sx={{
                  borderRadius: 2,
                  mb: 0.6,
                  py: 1,
                  px: 1.5,
                  color: actif ? "#ffffff" : "#a7f3d0",
                  bgcolor: actif ? "rgba(16, 185, 129, 0.3) !important" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#ffffff" },
                }}
              >
                <ListItemIcon sx={{ color: actif ? "#34d399" : "#a7f3d0", minWidth: 36 }}>
                  {m.icon}
                </ListItemIcon>
                <ListItemText
                  primary={m.titre}
                  primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: actif ? 700 : 500 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      {/* Contenu principal */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: `calc(100% - ${LARGEUR_MENU}px)` }}>
        <Toolbar sx={{ minHeight: 56 }} />
        <Outlet />
      </Box>
    </Box>
  );
}

import { Link, Outlet, useLocation } from "react-router-dom";
import {
  AppBar, Box, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, Stack, Chip
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import MedicationIcon from "@mui/icons-material/Medication";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";

const LARGEUR_MENU = 215;

const MENU = [
  { chemin: "/patients", titre: "Gestion Patients", icon: <PeopleIcon fontSize="small" /> },
  { chemin: "/vigilance", titre: "Vigilance Clinique", icon: <DashboardIcon fontSize="small" /> },
  { chemin: "/medicaments", titre: "Médicaments", icon: <MedicationIcon fontSize="small" /> },
  { chemin: "/risques", titre: "Risques", icon: <WarningAmberIcon fontSize="small" /> },
  { chemin: "/prescriptions", titre: "Prescriptions", icon: <AssignmentIcon fontSize="small" /> },
  { chemin: "/assistant", titre: "Assistant NLP", icon: <SmartToyIcon fontSize="small" /> },
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
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Toolbar variant="dense" sx={{ justifyContent: "space-between", minHeight: 48, px: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LocalHospitalIcon fontSize="small" />
            <Typography variant="subtitle1" fontWeight="bold">
              Pharma-Santé
            </Typography>
            <Chip
              label="Web Sémantique · Domaine Patients"
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "0.7rem", height: 22 }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
            Apache Jena Fuseki · SPARQL 1.1 · spaCy NLP
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
        <Toolbar variant="dense" sx={{ minHeight: 48 }} />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" sx={{ color: "#a7f3d0", fontWeight: "bold", letterSpacing: 0.5, fontSize: "0.68rem" }}>
            NAVIGATION
          </Typography>
        </Box>
        <List sx={{ px: 1, py: 0 }}>
          {MENU.map((m) => {
            const actif = pathname === m.chemin || pathname.startsWith(m.chemin + "/");
            return (
              <ListItemButton
                key={m.chemin}
                component={Link}
                to={m.chemin}
                selected={actif}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.4,
                  py: 0.75,
                  color: actif ? "#ffffff" : "#a7f3d0",
                  bgcolor: actif ? "rgba(16, 185, 129, 0.3) !important" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#ffffff" },
                }}
              >
                <ListItemIcon sx={{ color: actif ? "#34d399" : "#a7f3d0", minWidth: 32 }}>
                  {m.icon}
                </ListItemIcon>
                <ListItemText
                  primary={m.titre}
                  primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: actif ? 600 : 400 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      {/* Contenu principal */}
      <Box component="main" sx={{ flexGrow: 1, p: 2.5, width: `calc(100% - ${LARGEUR_MENU}px)` }}>
        <Toolbar variant="dense" sx={{ minHeight: 48 }} />
        <Outlet />
      </Box>
    </Box>
  );
}

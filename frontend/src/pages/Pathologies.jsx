import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Grid, IconButton,
  InputAdornment, Paper, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import LocalHospitalOutlinedIcon from "@mui/icons-material/LocalHospitalOutlined";
import HealingOutlinedIcon from "@mui/icons-material/HealingOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

const FORMULAIRE_VIDE = { id: "", libelle: "" };

export default function Pathologies() {
  const [pathologies, setPathologies] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sparql, setSparql] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtreActif, setFiltreActif] = useState("toutes"); // "toutes", "actives", "vides"
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  // Dialogs
  const [formulaire, setFormulaire] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [detailPatho, setDetailPatho] = useState(null);
  const [chargementDetail, setChargementDetail] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const res = await api.listerPathologies(recherche);
      setPathologies(res.data || []);
      setSparql(res.sparql || "");
    } catch (e) {
      setErreur(e.message);
      setPathologies([]);
    } finally {
      setChargement(false);
    }
  }, [recherche]);

  useEffect(() => {
    const t = setTimeout(charger, 250);
    return () => clearTimeout(t);
  }, [charger]);

  // KPIs
  const total = pathologies.length;
  const nbActives = pathologies.filter((p) => (p.nb_patients ?? 0) > 0).length;
  const nbOrphelines = pathologies.filter((p) => (p.nb_patients ?? 0) === 0).length;

  // Filtrage
  const pathologiesFiltrees = pathologies.filter((p) => {
    if (filtreActif === "actives" && (p.nb_patients ?? 0) === 0) return false;
    if (filtreActif === "vides" && (p.nb_patients ?? 0) > 0) return false;
    return true;
  });

  // Enregistrer (Création / Modification)
  const enregistrer = async () => {
    if (!formulaire.libelle.trim()) {
      return setErreur("Le nom de la maladie est obligatoire");
    }
    try {
      if (formulaire.mode === "modif") {
        const res = await api.modifierPathologie(formulaire.id, { libelle: formulaire.libelle.trim() });
        setMessage("Maladie modifiée avec succès dans Fuseki");
        setSparql(res.sparql);
      } else {
        const corps = { libelle: formulaire.libelle.trim() };
        if (formulaire.id.trim()) corps.id = formulaire.id.trim();
        const res = await api.creerPathologie(corps);
        setMessage("Nouvelle maladie insérée avec succès (INSERT DATA)");
        setSparql(res.sparql);
      }
      setFormulaire(null);
      setErreur("");
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  };

  // Supprimer
  const supprimer = async () => {
    try {
      const res = await api.supprimerPathologie(aSupprimer.id);
      setMessage("Maladie supprimée du graphe RDF");
      setSparql(res.sparql);
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreur(e.message);
      setASupprimer(null);
    }
  };

  // Voir les patients d'une pathologie
  const ouvrirDetail = async (p) => {
    setChargementDetail(true);
    setDetailPatho({ id: p.id, libelle: p.libelle, patients: [] });
    try {
      const res = await api.fichePathologie(p.id);
      setDetailPatho(res.data);
      if (res.sparql) setSparql(res.sparql);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargementDetail(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* En-tête de page */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h4" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
              Maladies & Pathologies
            </Typography>
            <Chip
              label="Ontologie :Pathologie"
              size="small"
              sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.78rem" }}
            />
          </Stack>
          <Typography variant="body1" color="#64748b" sx={{ mt: 0.3 }}>
            Gestion du référentiel des pathologies et suivi des patients atteints
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setErreur(""); setFormulaire({ ...FORMULAIRE_VIDE, mode: "ajout" }); }}
          sx={{
            bgcolor: "#065f46",
            "&:hover": { bgcolor: "#044e39" },
            fontSize: "0.92rem",
            px: 2.5,
            py: 1,
            borderRadius: 2.5,
            boxShadow: "0 2px 4px rgba(6,95,70,0.2)",
          }}
        >
          Nouvelle maladie
        </Button>
      </Stack>

      {/* 3 Cartes KPI synthétiques */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setFiltreActif("toutes")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: filtreActif === "toutes" ? "2px solid #065f46" : "1px solid #e2e8f0",
              bgcolor: filtreActif === "toutes" ? "#f0fdf4" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#065f46", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                  Total des maladies
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#0f172a" sx={{ mt: 0.5 }}>
                  {total}
                </Typography>
                <Typography variant="body2" color="#64748b" sx={{ mt: 0.3 }}>
                  Toutes les classes <code>:Pathologie</code>
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#dcfce7", color: "#065f46", width: 48, height: 48 }}>
                <LocalHospitalOutlinedIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setFiltreActif(filtreActif === "actives" ? "toutes" : "actives")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: filtreActif === "actives" ? "2px solid #2563eb" : "1px solid #e2e8f0",
              bgcolor: filtreActif === "actives" ? "#eff6ff" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#2563eb", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                  Maladies actives
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#1d4ed8" sx={{ mt: 0.5 }}>
                  {nbActives}
                </Typography>
                <Typography variant="body2" color="#1e40af" sx={{ mt: 0.3 }}>
                  Avec au moins 1 patient affecté
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#dbeafe", color: "#2563eb", width: 48, height: 48 }}>
                <HealingOutlinedIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={0}
            onClick={() => setFiltreActif(filtreActif === "vides" ? "toutes" : "vides")}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: filtreActif === "vides" ? "2px solid #64748b" : "1px solid #e2e8f0",
              bgcolor: filtreActif === "vides" ? "#f1f5f9" : "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { borderColor: "#64748b", transform: "translateY(-2px)" },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" sx={{ color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.75rem" }}>
                  Sans patient
                </Typography>
                <Typography variant="h4" fontWeight="800" color="#475569" sx={{ mt: 0.5 }}>
                  {nbOrphelines}
                </Typography>
                <Typography variant="body2" color="#64748b" sx={{ mt: 0.3 }}>
                  0 patient actuellement lié
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: "#f1f5f9", color: "#475569", width: 48, height: 48 }}>
                <CheckCircleOutlineIcon fontSize="medium" />
              </Avatar>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Barre de recherche et filtres d'onglets */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant={filtreActif === "toutes" ? "contained" : "outlined"}
              onClick={() => setFiltreActif("toutes")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: filtreActif === "toutes" ? "#065f46" : "transparent",
                color: filtreActif === "toutes" ? "#ffffff" : "#475569",
                borderColor: "#cbd5e1",
                "&:hover": { bgcolor: filtreActif === "toutes" ? "#044e39" : "#f1f5f9" },
              }}
            >
              Toutes ({total})
            </Button>
            <Button
              variant={filtreActif === "actives" ? "contained" : "outlined"}
              onClick={() => setFiltreActif("actives")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: filtreActif === "actives" ? "#2563eb" : "transparent",
                color: filtreActif === "actives" ? "#ffffff" : "#1d4ed8",
                borderColor: filtreActif === "actives" ? "#2563eb" : "#cbd5e1",
                "&:hover": { bgcolor: filtreActif === "actives" ? "#1d4ed8" : "#dbeafe" },
              }}
            >
              Actives ({nbActives})
            </Button>
            <Button
              variant={filtreActif === "vides" ? "contained" : "outlined"}
              onClick={() => setFiltreActif("vides")}
              sx={{
                borderRadius: 2,
                fontSize: "0.85rem",
                px: 2,
                py: 0.6,
                bgcolor: filtreActif === "vides" ? "#475569" : "transparent",
                color: filtreActif === "vides" ? "#ffffff" : "#475569",
                borderColor: "#cbd5e1",
                "&:hover": { bgcolor: filtreActif === "vides" ? "#334155" : "#f1f5f9" },
              }}
            >
              Sans patient ({nbOrphelines})
            </Button>
          </Stack>

          {/* Champ de recherche */}
          <TextField
            placeholder="Rechercher une maladie par nom ou identifiant..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: recherche && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setRecherche("")}>
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              flexGrow: 1,
              minWidth: 260,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                fontSize: "0.9rem",
                bgcolor: "#f8fafc",
              },
            }}
          />
        </Stack>
      </Paper>

      {erreur && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.88rem" }} onClose={() => setErreur("")}>
          {erreur}
        </Alert>
      )}

      {/* Tableau des pathologies */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: "#f8fafc" }}>
            <TableRow>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Nom de la maladie
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Identifiant
              </TableCell>
              <TableCell sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Patients atteints
              </TableCell>
              <TableCell align="right" sx={{ color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, py: 1.8 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chargement && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} sx={{ color: "#065f46" }} />
                  <Typography variant="body2" sx={{ display: "block", mt: 1.5, color: "#64748b" }}>
                    Chargement des pathologies depuis Fuseki...
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement && pathologiesFiltrees.length === 0 && !erreur && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                  <Typography variant="body1" color="#64748b">
                    Aucune maladie ne correspond à vos critères.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {!chargement &&
              pathologiesFiltrees.map((p) => {
                const nb = p.nb_patients ?? 0;
                return (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                      transition: "background-color 0.15s",
                    }}
                  >
                    {/* Nom avec icône */}
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={1.75} alignItems="center">
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            bgcolor: nb > 0 ? "#dbeafe" : "#f1f5f9",
                            color: nb > 0 ? "#1d4ed8" : "#64748b",
                          }}
                        >
                          <LocalHospitalOutlinedIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: "#0f172a" }}>
                            {p.libelle}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* Identifiant */}
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        size="small"
                        label={`:${p.id}`}
                        variant="outlined"
                        sx={{
                          fontSize: "0.78rem",
                          fontFamily: "monospace",
                          bgcolor: "#f8fafc",
                          borderColor: "#cbd5e1",
                          color: "#334155",
                          height: 24,
                        }}
                      />
                    </TableCell>

                    {/* Patients atteints */}
                    <TableCell sx={{ py: 1.5 }}>
                      {nb > 0 ? (
                        <Chip
                          size="small"
                          icon={<PeopleAltOutlinedIcon sx={{ fontSize: "16px !important" }} />}
                          label={`${nb} patient(s)`}
                          onClick={() => ouvrirDetail(p)}
                          sx={{
                            bgcolor: "#dbeafe",
                            color: "#1d4ed8",
                            fontWeight: 700,
                            cursor: "pointer",
                            "&:hover": { bgcolor: "#bfdbfe" },
                          }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label="0 patient"
                          variant="outlined"
                          sx={{ color: "#64748b", borderColor: "#cbd5e1" }}
                        />
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                        <Tooltip title="Voir les patients souffrant de cette maladie">
                          <IconButton
                            size="small"
                            onClick={() => ouvrirDetail(p)}
                            sx={{ color: "#2563eb", bgcolor: "#eff6ff", "&:hover": { bgcolor: "#dbeafe" } }}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Modifier le libellé">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setErreur("");
                              setFormulaire({ id: p.id, libelle: p.libelle, mode: "modif" });
                            }}
                            sx={{ color: "#475569", bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" } }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Supprimer la maladie du graphe">
                          <IconButton
                            size="small"
                            onClick={() => setASupprimer(p)}
                            sx={{ color: "#dc2626", bgcolor: "#fef2f2", "&:hover": { bgcolor: "#fee2e2" } }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Box SPARQL */}
      <SparqlBox sparql={sparql} />

      {/* Modal Création / Modification */}
      <Dialog
        open={!!formulaire}
        onClose={() => setFormulaire(null)}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ bgcolor: "#065f46", color: "white", py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>
          {formulaire?.mode === "modif" ? `Modifier :${formulaire.id}` : "Nouvelle maladie (INSERT DATA)"}
        </DialogTitle>
        <DialogContent sx={{ p: 3, mt: 1 }}>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            {erreur && (
              <Alert severity="error" sx={{ py: 0.75, fontSize: "0.88rem", borderRadius: 2 }}>
                {erreur}
              </Alert>
            )}

            <TextField
              label="Nom de la maladie / pathologie"
              required
              fullWidth
              value={formulaire?.libelle ?? ""}
              onChange={(e) => setFormulaire({ ...formulaire, libelle: e.target.value })}
              helperText="Ex: Diabète de type 2, Asthme sévère, etc."
            />

            {formulaire?.mode === "ajout" && (
              <TextField
                label="Identifiant ontologique (optionnel)"
                fullWidth
                value={formulaire?.id ?? ""}
                onChange={(e) => setFormulaire({ ...formulaire, id: e.target.value })}
                helperText="Généré automatiquement en CamelCase si laissé vide (ex: AsthmeSevere)"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setFormulaire(null)} sx={{ textTransform: "none", color: "#64748b" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={enregistrer}
            sx={{
              bgcolor: "#065f46",
              "&:hover": { bgcolor: "#044e39" },
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
            }}
          >
            {formulaire?.mode === "modif" ? "Mettre à jour" : "Insérer dans Fuseki"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Confirmation de suppression */}
      <Dialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ color: "#dc2626", fontSize: "1.05rem", fontWeight: 700 }}>
          Supprimer cette maladie ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.9rem", color: "#475569" }}>
            Êtes-vous sûr de vouloir supprimer la pathologie <strong>{aSupprimer?.libelle}</strong> (identifiant <code>:{aSupprimer?.id}</code>) ?
            <br />
            <br />
            Tous les liens <code>:souffreDe</code> reliant des patients à cette maladie seront également retirés via une requête <code>DELETE WHERE</code>.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setASupprimer(null)} sx={{ textTransform: "none", color: "#64748b" }}>
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={supprimer}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
          >
            Confirmer la suppression
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Détail des patients atteints */}
      <Dialog
        open={!!detailPatho}
        onClose={() => setDetailPatho(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ bgcolor: "#2563eb", color: "white", py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>
          Patients atteints de : {detailPatho?.libelle}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {chargementDetail ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : detailPatho?.patients?.length === 0 ? (
            <Typography variant="body1" color="#64748b" sx={{ py: 3, textAlign: "center" }}>
              Aucun patient n'est actuellement diagnostiqué avec cette pathologie.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {detailPatho?.patients?.map((pat) => (
                <Paper
                  key={pat.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    px: 2,
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {pat.nom} {pat.prenom || ""}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>
                      Âge : {pat.age ? `${pat.age} ans` : "Non renseigné"} · <code>:{pat.id}</code>
                    </Typography>
                  </Box>
                  <Button
                    component={Link}
                    to={`/patients/${pat.id}`}
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: "none", borderRadius: 2, fontSize: "0.82rem" }}
                  >
                    Voir dossier
                  </Button>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDetailPatho(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!message}
        autoHideDuration={3000}
        onClose={() => setMessage("")}
        message={message}
      />
    </Box>
  );
}

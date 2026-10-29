import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, FormControl, Grid, IconButton, InputLabel, MenuItem, Paper,
  Select, Stack, TextField, Tooltip, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";
import MedicationIcon from "@mui/icons-material/Medication";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import PersonIcon from "@mui/icons-material/Person";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import CodeIcon from "@mui/icons-material/Code";
import CloseIcon from "@mui/icons-material/Close";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

function getInitials(prenom, nom) {
  const p = (prenom || "").trim()[0] || "";
  const n = (nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "P";
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fiche, setFiche] = useState(null);
  const [sparql, setSparql] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Référentiels pour menus déroulants
  const [refMedicaments, setRefMedicaments] = useState([]);
  const [refPathologies, setRefPathologies] = useState([]);
  const [refMedecins, setRefMedecins] = useState([]);

  // Dialogs
  const [dialogModif, setDialogModif] = useState(false);
  const [dialogSuppr, setDialogSuppr] = useState(false);
  const [dialogAddMed, setDialogAddMed] = useState(false);
  const [dialogAddPatho, setDialogAddPatho] = useState(false);
  const [dialogSetMedecin, setDialogSetMedecin] = useState(false);

  // Sélections
  const [formulaire, setFormulaire] = useState({ nom: "", prenom: "", age: "" });
  const [selectedMed, setSelectedMed] = useState("");
  const [selectedPatho, setSelectedPatho] = useState("");
  const [selectedMedecin, setSelectedMedecin] = useState("");

  const chargerFiche = async () => {
    try {
      setErreur("");
      const res = await api.get(`/patients/${id}`);
      setFiche(res.data);
      setSparql(res.sparql);
      setFormulaire({
        nom: res.data.nom || "",
        prenom: res.data.prenom || "",
        age: String(res.data.age ?? ""),
      });
    } catch (e) {
      setErreur(e.message);
    }
  };

  useEffect(() => {
    chargerFiche();
    api.referentielMedicaments().then((r) => setRefMedicaments(r.data)).catch(() => {});
    api.referentielPathologies().then((r) => setRefPathologies(r.data)).catch(() => {});
    api.referentielMedecins().then((r) => setRefMedecins(r.data)).catch(() => {});
  }, [id]);

  // ---------- CRUD Attributs ----------
  const handleModifier = async () => {
    const age = Number(formulaire.age);
    if (!formulaire.nom.trim()) return setErreur("Le nom est obligatoire");
    if (formulaire.age === "" || !Number.isInteger(age) || age < 0 || age > 120)
      return setErreur("L'âge doit être un entier entre 0 et 120 (axiome OWL)");

    const corps = { nom: formulaire.nom.trim(), age };
    if (formulaire.prenom.trim()) corps.prenom = formulaire.prenom.trim();
    try {
      const res = await api.put(`/patients/${id}`, corps);
      setSparql(res.sparql);
      setSucces("Attributs du patient mis à jour avec succès");
      setDialogModif(false);
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleSupprimer = async () => {
    try {
      await api.del(`/patients/${id}`);
      navigate("/patients");
    } catch (e) {
      setErreur(e.message);
      setDialogSuppr(false);
    }
  };

  // ---------- CRUD Relations Ontologiques ----------
  const handleAjouterMedicament = async () => {
    if (!selectedMed) return;
    try {
      const res = await api.ajouterMedicament(id, selectedMed);
      setSparql(res.sparql);
      setSucces(`Médicament :${selectedMed} associé au patient (:prendMedicament)`);
      setDialogAddMed(false);
      setSelectedMed("");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleSupprimerMedicament = async (idMed) => {
    try {
      const res = await api.supprimerMedicament(id, idMed);
      setSparql(res.sparql);
      setSucces(`Médicament :${idMed} retiré (:prendMedicament supprimé)`);
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleAjouterPathologie = async () => {
    if (!selectedPatho) return;
    try {
      const res = await api.ajouterPathologie(id, selectedPatho);
      setSparql(res.sparql);
      setSucces(`Pathologie :${selectedPatho} associée au patient (:souffreDe)`);
      setDialogAddPatho(false);
      setSelectedPatho("");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleSupprimerPathologie = async (idPatho) => {
    try {
      const res = await api.supprimerPathologie(id, idPatho);
      setSparql(res.sparql);
      setSucces(`Pathologie :${idPatho} retirée (:souffreDe supprimé)`);
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleAssignerMedecin = async () => {
    if (!selectedMedecin) return;
    try {
      const res = await api.assignerMedecin(id, selectedMedecin);
      setSparql(res.sparql);
      setSucces(`Médecin :${selectedMedecin} assigné (axiome max 1 respecté)`);
      setDialogSetMedecin(false);
      setSelectedMedecin("");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleRetirerMedecin = async () => {
    try {
      const res = await api.retirerMedecin(id);
      setSparql(res.sparql);
      setSucces("Médecin référent retiré");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  // ---------- Requêtes SPARQL variées ----------
  const handleTesterAsk = async () => {
    try {
      const res = await api.askPolymedique(id);
      setSparql(res.sparql);
      const rep = res.data.polymedique_ask;
      setSucces(
        `Résultat SPARQL ASK : ${rep ? "OUI (true) — Le patient prend ≥ 3 médicaments" : "NON (false) — Moins de 3 médicaments"}`
      );
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleDescribeRdf = async () => {
    try {
      const res = await api.describeRdf(id);
      setSparql(res.data.rdf_turtle || res.sparql);
      setSucces("Graphe RDF du patient extrait via la requête SPARQL DESCRIBE");
    } catch (e) {
      setErreur(e.message);
    }
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* Barre de retour et actions rapides */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button
          component={Link}
          to="/patients"
          startIcon={<ArrowBackIcon />}
          sx={{
            textTransform: "none",
            fontSize: "0.82rem",
            color: "#64748b",
            fontWeight: 600,
            "&:hover": { color: "#065f46" },
          }}
        >
          Retour à la liste des dossiers
        </Button>
      </Stack>

      {erreur && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.82rem" }} onClose={() => setErreur("")}>
          {erreur}
        </Alert>
      )}

      {succes && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2, fontSize: "0.82rem" }} onClose={() => setSucces("")}>
          {succes}
        </Alert>
      )}

      {!fiche && !erreur && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={32} sx={{ color: "#065f46" }} />
        </Box>
      )}

      {fiche && (
        <Stack spacing={2.5}>
          {/* Carte En-tête Patient */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  sx={{
                    width: 54,
                    height: 54,
                    bgcolor: fiche.polymedique ? "#fef3c7" : fiche.pathologie_multiple ? "#dbeafe" : "#ecfdf5",
                    color: fiche.polymedique ? "#b45309" : fiche.pathologie_multiple ? "#1d4ed8" : "#065f46",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    border: "2px solid #ffffff",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  }}
                >
                  {getInitials(fiche.prenom, fiche.nom)}
                </Avatar>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h5" fontWeight="700" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
                      {fiche.nom} {fiche.prenom || ""}
                    </Typography>
                    <Chip
                      label={`:${fiche.id}`}
                      size="small"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        bgcolor: "#f1f5f9",
                        color: "#475569",
                        fontWeight: 600,
                      }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem" }}>
                      Âge : <strong>{fiche.age} ans</strong>
                    </Typography>
                    <Typography variant="caption" color="#94a3b8">·</Typography>
                    <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem" }}>
                      Médecin :{" "}
                      <strong>
                        {fiche.medecin ? `Dr. ${fiche.medecin.nom}` : "Non assigné"}
                      </strong>
                    </Typography>
                  </Stack>
                </Box>
              </Stack>

              {/* Badges d'état clinique et Boutons d'action */}
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {fiche.polymedique && (
                  <Chip
                    size="small"
                    icon={<MedicationIcon sx={{ fontSize: "14px !important" }} />}
                    label="Patient Polymédiqué"
                    sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 600, fontSize: "0.72rem" }}
                  />
                )}
                {fiche.pathologie_multiple && (
                  <Chip
                    size="small"
                    icon={<WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
                    label="Comorbidités Multiples"
                    sx={{ bgcolor: "#dbeafe", color: "#1d4ed8", fontWeight: 600, fontSize: "0.72rem" }}
                  />
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setDialogModif(true)}
                  sx={{
                    textTransform: "none",
                    fontSize: "0.78rem",
                    borderColor: "#cbd5e1",
                    color: "#334155",
                    borderRadius: 2,
                    "&:hover": { borderColor: "#065f46", color: "#065f46" },
                  }}
                >
                  Modifier infos
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => setDialogSuppr(true)}
                  sx={{ textTransform: "none", fontSize: "0.78rem", borderRadius: 2 }}
                >
                  Supprimer
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Grille principale 2 Colonnes */}
          <Grid container spacing={2.5}>
            {/* Colonne GAUCHE : Traitement et Pathologies */}
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                {/* 1. Médicaments (:prendMedicament) */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MedicationIcon sx={{ color: "#065f46", fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                        Traitements Médicamenteux (<code>:prendMedicament</code>)
                      </Typography>
                      <Chip
                        label={fiche.medicaments.length}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          bgcolor: fiche.polymedique ? "#fef3c7" : "#f1f5f9",
                          color: fiche.polymedique ? "#b45309" : "#475569",
                        }}
                      />
                    </Stack>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setDialogAddMed(true)}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        borderColor: "#065f46",
                        color: "#065f46",
                        fontWeight: 600,
                        borderRadius: 2,
                        "&:hover": { bgcolor: "#ecfdf5" },
                      }}
                    >
                      Associer un médicament
                    </Button>
                  </Stack>

                  {fiche.polymedique && (
                    <Alert
                      severity="warning"
                      icon={<WarningAmberIcon fontSize="small" />}
                      sx={{ mb: 1.5, py: 0.5, fontSize: "0.78rem", borderRadius: 2 }}
                    >
                      <strong>Classe :PatientPolymedique validée :</strong> Le patient prend {fiche.medicaments.length} médicaments (seuil ontologique $\ge 3$).
                    </Alert>
                  )}

                  {fiche.medicaments.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2 }}>
                      <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem" }}>
                        Aucun médicament actuellement associé à ce dossier.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1}>
                      {fiche.medicaments.map((m) => (
                        <Paper
                          key={m.id}
                          elevation={0}
                          sx={{
                            p: 1.25,
                            px: 1.75,
                            borderRadius: 2,
                            border: "1px solid #f1f5f9",
                            bgcolor: "#f8fafc",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "all 0.15s",
                            "&:hover": { bgcolor: "#f1f5f9", borderColor: "#cbd5e1" },
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "#ecfdf5", color: "#065f46", display: "flex" }}>
                              <MedicationIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>
                                {m.nom ?? m.id}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.7rem" }}>
                                :{m.id}
                              </Typography>
                            </Box>
                          </Stack>
                          <Tooltip title="Dissocier ce médicament">
                            <IconButton
                              size="small"
                              onClick={() => handleSupprimerMedicament(m.id)}
                              sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626", bgcolor: "#fee2e2" } }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>

                {/* 2. Pathologies (:souffreDe) */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LocalHospitalIcon sx={{ color: "#2563eb", fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                        Pathologies & Comorbidités (<code>:souffreDe</code>)
                      </Typography>
                      <Chip
                        label={fiche.pathologies.length}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          bgcolor: fiche.pathologie_multiple ? "#dbeafe" : "#f1f5f9",
                          color: fiche.pathologie_multiple ? "#1d4ed8" : "#475569",
                        }}
                      />
                    </Stack>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setDialogAddPatho(true)}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        borderColor: "#2563eb",
                        color: "#2563eb",
                        fontWeight: 600,
                        borderRadius: 2,
                        "&:hover": { bgcolor: "#eff6ff" },
                      }}
                    >
                      Associer une pathologie
                    </Button>
                  </Stack>

                  {fiche.pathologie_multiple && (
                    <Alert
                      severity="info"
                      icon={<WarningAmberIcon fontSize="small" />}
                      sx={{ mb: 1.5, py: 0.5, fontSize: "0.78rem", borderRadius: 2 }}
                    >
                      <strong>Classe :PatientAPathologieMultiple validée :</strong> Le patient présente {fiche.pathologies.length} pathologies (seuil ontologique $\ge 2$).
                    </Alert>
                  )}

                  {fiche.pathologies.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2 }}>
                      <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.82rem" }}>
                        Aucune pathologie diagnostiquée enregistrée.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1}>
                      {fiche.pathologies.map((p) => (
                        <Paper
                          key={p.id}
                          elevation={0}
                          sx={{
                            p: 1.25,
                            px: 1.75,
                            borderRadius: 2,
                            border: "1px solid #f1f5f9",
                            bgcolor: "#f8fafc",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "all 0.15s",
                            "&:hover": { bgcolor: "#f1f5f9", borderColor: "#cbd5e1" },
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "#eff6ff", color: "#2563eb", display: "flex" }}>
                              <LocalHospitalIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>
                                {p.nom ?? p.id}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.7rem" }}>
                                :{p.id}
                              </Typography>
                            </Box>
                          </Stack>
                          <Tooltip title="Dissocier cette pathologie">
                            <IconButton
                              size="small"
                              onClick={() => handleSupprimerPathologie(p.id)}
                              sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626", bgcolor: "#fee2e2" } }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Stack>
            </Grid>

            {/* Colonne DROITE : Médecin, Vigilance Interactions, Outils SPARQL */}
            <Grid item xs={12} md={5}>
              <Stack spacing={2.5}>
                {/* 3. Médecin Référent (:estSuiviPar max 1) */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MedicalServicesIcon sx={{ color: "#065f46", fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                        Médecin Référent
                      </Typography>
                    </Stack>
                    <Chip
                      label="max 1 Medecin"
                      size="small"
                      sx={{ fontSize: "0.68rem", fontFamily: "monospace", bgcolor: "#f1f5f9", color: "#475569" }}
                    />
                  </Stack>

                  {fiche.medecin ? (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ bgcolor: "#dcfce7", color: "#065f46", width: 40, height: 40 }}>
                          <PersonIcon />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: "#065f46", fontSize: "0.84rem" }}>
                            Dr. {fiche.medecin.nom} {fiche.medecin.prenom ?? ""}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#047857", fontFamily: "monospace", fontSize: "0.7rem" }}>
                            :{fiche.medecin.id}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          onClick={() => setDialogSetMedecin(true)}
                          sx={{ textTransform: "none", fontSize: "0.72rem", borderColor: "#86efac", color: "#065f46" }}
                        >
                          Changer
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={handleRetirerMedecin}
                          sx={{ textTransform: "none", fontSize: "0.72rem" }}
                        >
                          Retirer
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box sx={{ p: 2, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2 }}>
                      <Typography variant="body2" color="#64748b" sx={{ fontSize: "0.8rem", mb: 1 }}>
                        Aucun médecin référent assigné.
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setDialogSetMedecin(true)}
                        sx={{
                          textTransform: "none",
                          fontSize: "0.75rem",
                          color: "#065f46",
                          borderColor: "#065f46",
                          fontWeight: 600,
                        }}
                      >
                        Assigner un médecin
                      </Button>
                    </Box>
                  )}
                </Paper>

                {/* 4. Vigilance Interactions Médicamenteuses */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a", mb: 1.5 }}>
                    Vigilance & Risques Croisés
                  </Typography>

                  {fiche.interactions?.length > 0 ? (
                    <Alert
                      severity="error"
                      icon={<ReportProblemIcon />}
                      sx={{
                        borderRadius: 2,
                        border: "1px solid #fca5a5",
                        bgcolor: "#fef2f2",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#991b1b", fontSize: "0.8rem" }}>
                        Interaction Médicamenteuse Détectée !
                      </Typography>
                      {fiche.interactions.map((inter, idx) => (
                        <Typography key={idx} variant="caption" sx={{ display: "block", mt: 0.5, color: "#7f1d1d" }}>
                          • <strong>{inter.nomMedA || inter.medA}</strong> + <strong>{inter.nomMedB || inter.medB}</strong>
                          {inter.libelle ? ` : ${inter.libelle}` : ""}
                        </Typography>
                      ))}
                    </Alert>
                  ) : (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5, bgcolor: "#f0fdf4", borderRadius: 2 }}>
                      <CheckCircleOutlineIcon sx={{ color: "#16a34a", fontSize: 22 }} />
                      <Typography variant="body2" sx={{ color: "#166534", fontSize: "0.8rem", fontWeight: 500 }}>
                        Aucune interaction médicamenteuse connue entre les traitements actuels.
                      </Typography>
                    </Stack>
                  )}
                </Paper>

                {/* 5. Démonstrateur SPARQL (Valeur Ajoutée pour la soutenance) */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: "1px solid #cbd5e1",
                    bgcolor: "#f8fafc",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#0f172a", mb: 0.5 }}>
                    Démonstrateur de requêtes SPARQL
                  </Typography>
                  <Typography variant="caption" color="#64748b" sx={{ display: "block", mb: 1.5, fontSize: "0.72rem" }}>
                    Testez la variété de requêtes devant l'examinateur (Critère Requêtes SPARQL & Valeur ajoutée).
                  </Typography>
                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<HelpOutlineIcon />}
                      onClick={handleTesterAsk}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        bgcolor: "#ffffff",
                        color: "#065f46",
                        borderColor: "#cbd5e1",
                        justifyContent: "flex-start",
                        py: 0.75,
                        borderRadius: 2,
                        "&:hover": { borderColor: "#065f46", bgcolor: "#f0fdf4" },
                      }}
                    >
                      Tester SPARQL ASK (Polymédication)
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CodeIcon />}
                      onClick={handleDescribeRdf}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        bgcolor: "#ffffff",
                        color: "#2563eb",
                        borderColor: "#cbd5e1",
                        justifyContent: "flex-start",
                        py: 0.75,
                        borderRadius: 2,
                        "&:hover": { borderColor: "#2563eb", bgcolor: "#eff6ff" },
                      }}
                    >
                      Exécuter SPARQL DESCRIBE (Graphe RDF)
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>
          </Grid>

          {/* SPARQL Box */}
          <SparqlBox sparql={sparql} />
        </Stack>
      )}

      {/* Modal Modifier Informations */}
      <Dialog open={dialogModif} onClose={() => setDialogModif(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>Modifier les attributs</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {erreur && <Alert severity="error" sx={{ py: 0.5, fontSize: "0.8rem" }}>{erreur}</Alert>}
            <TextField label="Nom" required fullWidth size="small" value={formulaire.nom}
              onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} />
            <TextField label="Prénom" fullWidth size="small" value={formulaire.prenom}
              onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })} />
            <TextField label="Âge (0–120)" type="number" required fullWidth size="small" value={formulaire.age}
              onChange={(e) => setFormulaire({ ...formulaire, age: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogModif(false)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button variant="contained" onClick={handleModifier} sx={{ textTransform: "none", bgcolor: "#065f46" }}>Mettre à jour</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Supprimer Patient */}
      <Dialog open={dialogSuppr} onClose={() => setDialogSuppr(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: "#dc2626", fontSize: "0.95rem", fontWeight: 600 }}>Supprimer le dossier ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.82rem" }}>
            Tous les triplets décrivant <strong>:{id}</strong> seront retirés de Fuseki via <code>DELETE WHERE</code>.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogSuppr(false)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button color="error" variant="contained" onClick={handleSupprimer} sx={{ textTransform: "none" }}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Associer Médicament */}
      <Dialog open={dialogAddMed} onClose={() => setDialogAddMed(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>Associer un médicament (:prendMedicament)</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Choisir un médicament</InputLabel>
              <Select value={selectedMed} label="Choisir un médicament" onChange={(e) => setSelectedMed(e.target.value)}>
                {refMedicaments.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.nom ? `${m.nom} (:${m.id})` : `:${m.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogAddMed(false)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button variant="contained" onClick={handleAjouterMedicament} disabled={!selectedMed} sx={{ textTransform: "none", bgcolor: "#065f46" }}>
            Associer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Associer Pathologie */}
      <Dialog open={dialogAddPatho} onClose={() => setDialogAddPatho(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>Associer une pathologie (:souffreDe)</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Choisir une pathologie</InputLabel>
              <Select value={selectedPatho} label="Choisir une pathologie" onChange={(e) => setSelectedPatho(e.target.value)}>
                {refPathologies.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.nom ? `${p.nom} (:${p.id})` : `:${p.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogAddPatho(false)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button variant="contained" onClick={handleAjouterPathologie} disabled={!selectedPatho} sx={{ textTransform: "none", bgcolor: "#2563eb" }}>
            Associer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Assigner Médecin */}
      <Dialog open={dialogSetMedecin} onClose={() => setDialogSetMedecin(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 1.75, fontSize: "0.95rem", fontWeight: 600 }}>Assigner un médecin référent (:estSuiviPar)</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Choisir un médecin</InputLabel>
              <Select value={selectedMedecin} label="Choisir un médecin" onChange={(e) => setSelectedMedecin(e.target.value)}>
                {refMedecins.map((med) => (
                  <MenuItem key={med.id} value={med.id}>
                    Dr. {med.nom} {med.prenom || ""} (:{med.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogSetMedecin(false)} sx={{ textTransform: "none" }}>Annuler</Button>
          <Button variant="contained" onClick={handleAssignerMedecin} disabled={!selectedMedecin} sx={{ textTransform: "none", bgcolor: "#065f46" }}>
            Valider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

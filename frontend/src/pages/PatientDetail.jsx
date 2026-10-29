import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, Grid, IconButton, InputLabel, MenuItem, Paper,
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
import SchoolIcon from "@mui/icons-material/School";
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
    api.referentielMedicaments().then((r) => setRefMedicaments(r.data || [])).catch(() => {});
    api.referentielPathologies().then((r) => setRefPathologies(r.data || [])).catch(() => {});
    api.referentielMedecins().then((r) => setRefMedecins(r.data || [])).catch(() => {});
  }, [id]);

  // ---------- CRUD Attributs ----------
  const handleModifier = async () => {
    const age = Number(formulaire.age);
    if (!formulaire.nom.trim()) return setErreur("Le nom de famille est obligatoire");
    if (formulaire.age === "" || !Number.isInteger(age) || age < 0 || age > 120)
      return setErreur("L'âge doit être un entier entre 0 et 120");

    const corps = { nom: formulaire.nom.trim(), age };
    if (formulaire.prenom.trim()) corps.prenom = formulaire.prenom.trim();
    try {
      const res = await api.put(`/patients/${id}`, corps);
      setSparql(res.sparql);
      setSucces("Informations du patient mises à jour");
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
      setSucces("Médicament associé au dossier");
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
      setSucces("Médicament retiré du dossier");
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
      setSucces("Maladie associée au dossier");
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
      setSucces("Maladie retirée du dossier");
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
      setSucces("Médecin traitant assigné");
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
      setSucces("Médecin traitant retiré");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  // ---------- Démonstrateur soutenance ----------
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Button
          component={Link}
          to="/patients"
          startIcon={<ArrowBackIcon />}
          sx={{
            textTransform: "none",
            fontSize: "0.9rem",
            color: "#64748b",
            fontWeight: 600,
            "&:hover": { color: "#065f46" },
          }}
        >
          Retour à la liste des patients
        </Button>
      </Stack>

      {erreur && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.88rem" }} onClose={() => setErreur("")}>
          {erreur}
        </Alert>
      )}

      {succes && (
        <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2.5, fontSize: "0.88rem" }} onClose={() => setSucces("")}>
          {succes}
        </Alert>
      )}

      {!fiche && !erreur && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={36} sx={{ color: "#065f46" }} />
        </Box>
      )}

      {fiche && (
        <Stack spacing={3}>
          {/* Carte En-tête Patient */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2.5}>
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 60,
                    height: 60,
                    bgcolor: fiche.polymedique ? "#fef3c7" : fiche.pathologie_multiple ? "#dbeafe" : "#ecfdf5",
                    color: fiche.polymedique ? "#b45309" : fiche.pathologie_multiple ? "#1d4ed8" : "#065f46",
                    fontWeight: 800,
                    fontSize: "1.25rem",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  }}
                >
                  {getInitials(fiche.prenom, fiche.nom)}
                </Avatar>
                <Box>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="h4" color="#0f172a" sx={{ letterSpacing: -0.5 }}>
                      {fiche.nom} {fiche.prenom || ""}
                    </Typography>
                    <Chip
                      label={`:${fiche.id}`}
                      size="small"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.78rem",
                        bgcolor: "#f1f5f9",
                        color: "#475569",
                        fontWeight: 700,
                        height: 24,
                      }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.6 }}>
                    <Typography variant="body1" color="#475569" sx={{ fontWeight: 600 }}>
                      Âge : <span style={{ color: "#0f172a" }}>{fiche.age} ans</span>
                    </Typography>
                    <Typography variant="caption" color="#cbd5e1">·</Typography>
                    <Typography variant="body1" color="#475569" sx={{ fontWeight: 600 }}>
                      Médecin :{" "}
                      <span style={{ color: "#0f172a" }}>
                        {fiche.medecin ? `Dr. ${fiche.medecin.nom}` : "Non assigné"}
                      </span>
                    </Typography>
                  </Stack>
                </Box>
              </Stack>

              {/* Badges d'état et Boutons d'action */}
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                {fiche.polymedique && (
                  <Chip
                    size="medium"
                    icon={<MedicationIcon sx={{ fontSize: "17px !important" }} />}
                    label="3 médicaments ou +"
                    sx={{ bgcolor: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "0.82rem" }}
                  />
                )}
                {fiche.pathologie_multiple && (
                  <Chip
                    size="medium"
                    icon={<WarningAmberIcon sx={{ fontSize: "17px !important" }} />}
                    label="Plusieurs maladies"
                    sx={{ bgcolor: "#dbeafe", color: "#1d4ed8", fontWeight: 700, fontSize: "0.82rem" }}
                  />
                )}
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setDialogModif(true)}
                  sx={{
                    fontSize: "0.86rem",
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
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => setDialogSuppr(true)}
                  sx={{ fontSize: "0.86rem", borderRadius: 2 }}
                >
                  Supprimer
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Grille principale 2 Colonnes */}
          <Grid container spacing={3}>
            {/* Colonne GAUCHE : Traitement et Maladies */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3}>
                {/* 1. Traitements médicamenteux */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <MedicationIcon sx={{ color: "#065f46", fontSize: 24 }} />
                      <Typography variant="h6" color="#0f172a">
                        Traitements médicamenteux
                      </Typography>
                      <Chip
                        label={fiche.medicaments.length}
                        size="small"
                        sx={{
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
                        fontSize: "0.82rem",
                        borderColor: "#065f46",
                        color: "#065f46",
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
                      sx={{ mb: 2, py: 0.75, fontSize: "0.84rem", borderRadius: 2 }}
                    >
                      <strong>Patient avec 3 médicaments ou plus :</strong> Surveillance requise pour prévenir les risques de polymédication.
                    </Alert>
                  )}

                  {fiche.medicaments.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2.5 }}>
                      <Typography variant="body1" color="#64748b">
                        Aucun médicament actuellement prescrit ou associé.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1.25}>
                      {fiche.medicaments.map((m) => (
                        <Paper
                          key={m.id}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            px: 2,
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
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ p: 1, borderRadius: 2, bgcolor: "#ecfdf5", color: "#065f46", display: "flex" }}>
                              <MedicationIcon sx={{ fontSize: 20 }} />
                            </Box>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 700, color: "#1e293b" }}>
                                {m.nom ?? m.id}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace" }}>
                                :{m.id}
                              </Typography>
                            </Box>
                          </Stack>
                          <Tooltip title="Retirer ce médicament">
                            <IconButton
                              size="small"
                              onClick={() => handleSupprimerMedicament(m.id)}
                              sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626", bgcolor: "#fee2e2" } }}
                            >
                              <CloseIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>

                {/* 2. Maladies & antécédents */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <LocalHospitalIcon sx={{ color: "#2563eb", fontSize: 24 }} />
                      <Typography variant="h6" color="#0f172a">
                        Maladies & antécédents
                      </Typography>
                      <Chip
                        label={fiche.pathologies.length}
                        size="small"
                        sx={{
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
                        fontSize: "0.82rem",
                        borderColor: "#2563eb",
                        color: "#2563eb",
                        borderRadius: 2,
                        "&:hover": { bgcolor: "#eff6ff" },
                      }}
                    >
                      Associer une maladie
                    </Button>
                  </Stack>

                  {fiche.pathologie_multiple && (
                    <Alert
                      severity="info"
                      icon={<WarningAmberIcon fontSize="small" />}
                      sx={{ mb: 2, py: 0.75, fontSize: "0.84rem", borderRadius: 2 }}
                    >
                      <strong>Patient avec plusieurs maladies :</strong> Suivi des comorbidités actives ({fiche.pathologies.length} diagnostiquées).
                    </Alert>
                  )}

                  {fiche.pathologies.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2.5 }}>
                      <Typography variant="body1" color="#64748b">
                        Aucune maladie ou antécédent médical enregistré.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1.25}>
                      {fiche.pathologies.map((p) => (
                        <Paper
                          key={p.id}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            px: 2,
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
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Box sx={{ p: 1, borderRadius: 2, bgcolor: "#eff6ff", color: "#2563eb", display: "flex" }}>
                              <LocalHospitalIcon sx={{ fontSize: 20 }} />
                            </Box>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 700, color: "#1e293b" }}>
                                {p.nom ?? p.id}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace" }}>
                                :{p.id}
                              </Typography>
                            </Box>
                          </Stack>
                          <Tooltip title="Retirer cette maladie">
                            <IconButton
                              size="small"
                              onClick={() => handleSupprimerPathologie(p.id)}
                              sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626", bgcolor: "#fee2e2" } }}
                            >
                              <CloseIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Stack>
            </Grid>

            {/* Colonne DROITE : Médecin, Alertes, et Démonstrateur soutenance */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={3}>
                {/* 3. Médecin traitant */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <MedicalServicesIcon sx={{ color: "#065f46", fontSize: 24 }} />
                      <Typography variant="h6" color="#0f172a">
                        Médecin traitant
                      </Typography>
                    </Stack>
                  </Stack>

                  {fiche.medecin ? (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: "#dcfce7", color: "#065f46", width: 46, height: 46 }}>
                          <PersonIcon fontSize="medium" />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: "#065f46" }}>
                            Dr. {fiche.medecin.nom} {fiche.medecin.prenom ?? ""}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#047857", fontFamily: "monospace" }}>
                            :{fiche.medecin.id}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          onClick={() => setDialogSetMedecin(true)}
                          sx={{ fontSize: "0.82rem", borderColor: "#86efac", color: "#065f46" }}
                        >
                          Changer de médecin
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={handleRetirerMedecin}
                          sx={{ fontSize: "0.82rem" }}
                        >
                          Retirer
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box sx={{ p: 3, textAlign: "center", bgcolor: "#f8fafc", borderRadius: 2.5 }}>
                      <Typography variant="body1" color="#64748b" sx={{ mb: 1.5 }}>
                        Aucun médecin traitant assigné.
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setDialogSetMedecin(true)}
                        sx={{
                          bgcolor: "#065f46",
                          "&:hover": { bgcolor: "#044e39" },
                          fontSize: "0.84rem",
                          borderRadius: 2,
                        }}
                      >
                        Assigner un médecin
                      </Button>
                    </Box>
                  )}
                </Paper>

                {/* 4. Risques d'association */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "#ffffff",
                  }}
                >
                  <Typography variant="h6" color="#0f172a" sx={{ mb: 2 }}>
                    Médicaments à ne pas associer
                  </Typography>

                  {fiche.interactions?.length > 0 ? (
                    <Alert
                      severity="error"
                      icon={<ReportProblemIcon />}
                      sx={{
                        borderRadius: 2.5,
                        border: "1px solid #fca5a5",
                        bgcolor: "#fef2f2",
                        p: 1.5,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#991b1b" }}>
                        Association dangereuse détectée !
                      </Typography>
                      {fiche.interactions.map((inter, idx) => (
                        <Typography key={idx} variant="body2" sx={{ display: "block", mt: 0.75, color: "#7f1d1d" }}>
                          • <strong>{inter.nomMedA || inter.medA}</strong> et <strong>{inter.nomMedB || inter.medB}</strong>
                          {inter.libelle ? ` : ${inter.libelle}` : ""}
                        </Typography>
                      ))}
                    </Alert>
                  ) : (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, bgcolor: "#f0fdf4", borderRadius: 2.5 }}>
                      <CheckCircleOutlineIcon sx={{ color: "#16a34a", fontSize: 24 }} />
                      <Typography variant="body1" sx={{ color: "#166534", fontWeight: 600 }}>
                        Aucune association dangereuse entre les médicaments actuels.
                      </Typography>
                    </Stack>
                  )}
                </Paper>

                {/* 5. Démonstrateur de requêtes SPARQL */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "1px solid #cbd5e1",
                    bgcolor: "#f8fafc",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <CodeIcon sx={{ color: "#065f46", fontSize: 22 }} />
                    <Typography variant="h6" color="#0f172a">
                      Démonstrateur SPARQL (ASK & DESCRIBE)
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="#64748b" sx={{ mb: 2 }}>
                    Outils de validation sémantique et requêtes avancées.
                  </Typography>
                  <Stack spacing={1.25}>
                    <Button
                      variant="outlined"
                      startIcon={<HelpOutlineIcon />}
                      onClick={handleTesterAsk}
                      sx={{
                        fontSize: "0.84rem",
                        bgcolor: "#ffffff",
                        color: "#065f46",
                        borderColor: "#cbd5e1",
                        justifyContent: "flex-start",
                        py: 1,
                        borderRadius: 2,
                        "&:hover": { borderColor: "#065f46", bgcolor: "#f0fdf4" },
                      }}
                    >
                      Tester SPARQL ASK (Polymédication)
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CodeIcon />}
                      onClick={handleDescribeRdf}
                      sx={{
                        fontSize: "0.84rem",
                        bgcolor: "#ffffff",
                        color: "#2563eb",
                        borderColor: "#cbd5e1",
                        justifyContent: "flex-start",
                        py: 1,
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

          {/* Requête SPARQL */}
          <SparqlBox sparql={sparql} />
        </Stack>
      )}

      {/* Modal Modifier Informations */}
      <Dialog open={dialogModif} onClose={() => setDialogModif(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>Modifier le patient</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {erreur && <Alert severity="error" sx={{ py: 0.5, fontSize: "0.88rem" }}>{erreur}</Alert>}
            <TextField label="Nom de famille" required fullWidth value={formulaire.nom}
              onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} />
            <TextField label="Prénom (optionnel)" fullWidth value={formulaire.prenom}
              onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })} />
            <TextField label="Âge" type="number" required fullWidth value={formulaire.age}
              onChange={(e) => setFormulaire({ ...formulaire, age: e.target.value })} helperText="Âge entre 0 et 120" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogModif(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleModifier} sx={{ bgcolor: "#065f46" }}>Mettre à jour</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Supprimer Patient */}
      <Dialog open={dialogSuppr} onClose={() => setDialogSuppr(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: "#dc2626", fontSize: "1.05rem", fontWeight: 700 }}>Supprimer le dossier ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.9rem" }}>
            Êtes-vous sûr de vouloir supprimer le dossier de <strong>:{id}</strong> ?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogSuppr(false)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={handleSupprimer}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Associer Médicament */}
      <Dialog open={dialogAddMed} onClose={() => setDialogAddMed(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>Associer un médicament</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
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
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogAddMed(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAjouterMedicament} disabled={!selectedMed} sx={{ bgcolor: "#065f46" }}>
            Associer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Associer Maladie */}
      <Dialog open={dialogAddPatho} onClose={() => setDialogAddPatho(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>Associer une maladie</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Choisir une maladie</InputLabel>
              <Select value={selectedPatho} label="Choisir une maladie" onChange={(e) => setSelectedPatho(e.target.value)}>
                {refPathologies.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.nom ? `${p.nom} (:${p.id})` : `:${p.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogAddPatho(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAjouterPathologie} disabled={!selectedPatho} sx={{ bgcolor: "#2563eb" }}>
            Associer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Assigner Médecin */}
      <Dialog open={dialogSetMedecin} onClose={() => setDialogSetMedecin(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ py: 2, px: 3, fontSize: "1.05rem", fontWeight: 700 }}>Assigner un médecin traitant</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
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
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDialogSetMedecin(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAssignerMedecin} disabled={!selectedMedecin} sx={{ bgcolor: "#065f46" }}>
            Valider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

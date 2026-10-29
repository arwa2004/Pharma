import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  FormControlLabel, Grid, IconButton, InputLabel, MenuItem, Paper, Select,
  Snackbar, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MedicationIcon from "@mui/icons-material/Medication";
import BusinessIcon from "@mui/icons-material/Business";
import ScienceIcon from "@mui/icons-material/Science";
import CategoryIcon from "@mui/icons-material/Category";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import CodeIcon from "@mui/icons-material/Code";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";

import { api } from "../api.js";
import SparqlBox from "../components/SparqlBox.jsx";

export default function MedicamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fiche, setFiche] = useState(null);
  const [sparql, setSparql] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  // Dialogue de modification
  const [dialogEdition, setDialogEdition] = useState(false);
  const [formEdit, setFormEdit] = useState({});

  // Dialogue d'ajout molécule ou excipient
  const [dialogAjoutMol, setDialogAjoutMol] = useState(false);
  const [molChoisie, setMolChoisie] = useState("");
  const [dialogAjoutExc, setDialogAjoutExc] = useState(false);
  const [excChoisi, setExcChoisi] = useState("");

  // Référentiels
  const [refMolecules, setRefMolecules] = useState([]);
  const [refExcipients, setRefExcipients] = useState([]);
  const [refLabos, setRefLabos] = useState([]);
  const [refFormes, setRefFormes] = useState([]);
  const [refVoies, setRefVoies] = useState([]);
  const [refClasses, setRefClasses] = useState([]);

  // État des requêtes SPARQL ASK & DESCRIBE
  const [resultatAsk, setResultatAsk] = useState(null);
  const [grapheTurtle, setGrapheTurtle] = useState(null);

  const chargerFiche = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const res = await api.ficheMedicament(id);
      setFiche(res.data);
      setSparql(res.sparql);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    chargerFiche();
  }, [chargerFiche]);

  useEffect(() => {
    async function chargerRefs() {
      try {
        const [mols, excs, labs, frms, voies, clss] = await Promise.all([
          api.referentielMolecules(),
          api.referentielExcipients(),
          api.referentielLaboratoires(),
          api.referentielFormes(),
          api.referentielVoies(),
          api.referentielClasses(),
        ]);
        setRefMolecules(mols.data || []);
        setRefExcipients(excs.data || []);
        setRefLabos(labs.data || []);
        setRefFormes(frms.data || []);
        setRefVoies(voies.data || []);
        setRefClasses(clss.data || []);
      } catch (e) {
        console.error(e);
      }
    }
    chargerRefs();
  }, []);

  // Déclencher la requête SPARQL ASK
  const handleExecuterAsk = async () => {
    try {
      const res = await api.askOrdonnance(id);
      setResultatAsk(res.data);
      setSparql(res.sparql);
      setMessage("Requête SPARQL ASK exécutée !");
    } catch (e) {
      setErreur(e.message);
    }
  };

  // Déclencher la requête SPARQL DESCRIBE
  const handleExecuterDescribe = async () => {
    try {
      const res = await api.describeMedicament(id);
      setGrapheTurtle(res.data?.turtle || "");
      setSparql(res.sparql);
      setMessage("Sous-graphe RDF récupéré via SPARQL DESCRIBE !");
    } catch (e) {
      setErreur(e.message);
    }
  };

  // Ouvrir formulaire d'édition
  const handleOuvrirEdition = () => {
    setFormEdit({
      nomCommercial: fiche.nomCommercial || "",
      codeAMM: fiche.codeAMM || "",
      dosageMg: fiche.dosageMg || "",
      surOrdonnance: Boolean(fiche.surOrdonnance),
      idLaboratoire: fiche.laboratoire?.id || "",
      idForme: fiche.forme?.id || "",
      idVoie: fiche.voie?.id || "",
      idClasse: fiche.classe?.id || "",
    });
    setDialogEdition(true);
  };

  const handleSauvegarderEdition = async (e) => {
    e.preventDefault();
    try {
      const res = await api.modifierMedicament(id, {
        nomCommercial: formEdit.nomCommercial,
        codeAMM: formEdit.codeAMM,
        dosageMg: parseFloat(formEdit.dosageMg),
        surOrdonnance: formEdit.surOrdonnance,
        idLaboratoire: formEdit.idLaboratoire,
        idForme: formEdit.idForme,
        idVoie: formEdit.idVoie,
        idClasse: formEdit.idClasse,
      });
      setMessage(res.data?.message || "Médicament mis à jour !");
      setSparql(res.sparql);
      setDialogEdition(false);
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  // Gestion des Molécules (Composition)
  const handleAjouterMolecule = async () => {
    if (!molChoisie) return;
    try {
      const res = await api.associerMolecule(id, molChoisie);
      setMessage(res.data?.message || "Molécule associée !");
      setSparql(res.sparql);
      setDialogAjoutMol(false);
      setMolChoisie("");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleRetirerMolecule = async (idMol) => {
    try {
      const res = await api.dissocierMolecule(id, idMol);
      setMessage(res.data?.message || "Molécule retirée.");
      setSparql(res.sparql);
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  // Gestion des Excipients (Composition)
  const handleAjouterExcipient = async () => {
    if (!excChoisi) return;
    try {
      const res = await api.associerExcipient(id, excChoisi);
      setMessage(res.data?.message || "Excipient associé !");
      setSparql(res.sparql);
      setDialogAjoutExc(false);
      setExcChoisi("");
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  const handleRetirerExcipient = async (idExc) => {
    try {
      const res = await api.dissocierExcipient(id, idExc);
      setMessage(res.data?.message || "Excipient retiré.");
      setSparql(res.sparql);
      chargerFiche();
    } catch (e) {
      setErreur(e.message);
    }
  };

  if (chargement) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
        <CircularProgress sx={{ color: "#059669" }} />
      </Box>
    );
  }

  if (!fiche) {
    return (
      <Box sx={{ maxWidth: 900, mx: "auto", py: 4 }}>
        <Alert severity="error">Médicament introuvable ou erreur de chargement.</Alert>
        <Button startIcon={<ArrowBackIcon />} component={Link} to="/medicaments" sx={{ mt: 2 }}>
          Retour aux médicaments
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Bouton retour & Actions haut */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          component={Link}
          to="/medicaments"
          sx={{ color: "#475569", textTransform: "none", fontWeight: 600 }}
        >
          Retour à la liste des médicaments
        </Button>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<HelpOutlineIcon />}
            onClick={handleExecuterAsk}
            sx={{ textTransform: "none" }}
          >
            Tester SPARQL ASK
          </Button>
          <Button
            variant="outlined"
            startIcon={<CodeIcon />}
            onClick={handleExecuterDescribe}
            sx={{ textTransform: "none" }}
          >
            SPARQL DESCRIBE (Turtle)
          </Button>
          <Button
            variant="contained"
            startIcon={<EditOutlinedIcon />}
            onClick={handleOuvrirEdition}
            sx={{ bgcolor: "#059669", "&:hover": { bgcolor: "#047857" }, textTransform: "none" }}
          >
            Modifier
          </Button>
        </Stack>
      </Stack>

      {/* Hero Card : Fiche d'identité du médicament */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}>
          <Avatar sx={{ bgcolor: "#ecfdf5", color: "#059669", width: 68, height: 68 }}>
            <MedicationIcon sx={{ fontSize: 38 }} />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <Typography variant="h5" fontWeight="800" color="#0f172a">
                {fiche.nomCommercial}
              </Typography>
              <Chip
                label={`${fiche.dosageMg || "?"} mg`}
                sx={{ bgcolor: "#0f172a", color: "#fff", fontWeight: 700 }}
              />
              {fiche.surOrdonnance ? (
                <Chip
                  label="Prescription Obligatoire"
                  sx={{ bgcolor: "#eff6ff", color: "#1d4ed8", fontWeight: 600 }}
                />
              ) : (
                <Chip
                  label="Vente Libre (Sans ordonnance)"
                  sx={{ bgcolor: "#f0fdf4", color: "#15803d", fontWeight: 600 }}
                />
              )}
              {fiche.estContreIndicationAbsolue && (
                <Chip
                  icon={<WarningAmberIcon sx={{ "&&": { color: "#dc2626" } }} />}
                  label="Contre-Indication Absolue (Classe Définie HermiT)"
                  sx={{ bgcolor: "#fee2e2", color: "#b91c1c", fontWeight: 700 }}
                />
              )}
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 1, color: "text.secondary" }} flexWrap="wrap">
              <Typography variant="body2">
                <strong>URI RDF :</strong> :{fiche.id}
              </Typography>
              {fiche.codeAMM && (
                <Typography variant="body2">
                  <strong>Code AMM :</strong> {fiche.codeAMM}
                </Typography>
              )}
              {fiche.laboratoire && (
                <Typography variant="body2">
                  <strong>Fabricant :</strong> {fiche.laboratoire.nom} ({fiche.laboratoire.pays})
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Résultat interactif SPARQL ASK si déclenché */}
      {resultatAsk && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          onClose={() => setResultatAsk(null)}
          icon={<HelpOutlineIcon />}
        >
          <Typography variant="subtitle2" fontWeight="700">
            Résultat de la requête SPARQL ASK :
          </Typography>
          <Typography variant="body2">
            {resultatAsk.message} — Réponse booléenne retournée par le moteur Fuseki :{" "}
            <strong>{resultatAsk.necessite_ordonnance ? "TRUE (Vrai)" : "FALSE (Faux)"}</strong>.
          </Typography>
        </Alert>
      )}

      {/* Résultat interactif SPARQL DESCRIBE si déclenché */}
      {grapheTurtle && (
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: "#1e293b", color: "#e2e8f0" }} elevation={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="700" color="#38bdf8">
              Sous-Graphe RDF Turtle (SPARQL DESCRIBE :{fiche.id})
            </Typography>
            <Button size="small" onClick={() => setGrapheTurtle(null)} sx={{ color: "#94a3b8" }}>
              Masquer
            </Button>
          </Stack>
          <Box
            component="pre"
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: "#0f172a",
              color: "#a7f3d0",
              overflowX: "auto",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              m: 0,
            }}
          >
            {grapheTurtle}
          </Box>
        </Paper>
      )}

      {/* 2 Colonnes principales */}
      <Grid container spacing={3}>
        {/* Colonne Gauche : Composition chimique & Excipients */}
        <Grid item xs={12} md={7}>
          {/* Principes Actifs & Molécules */}
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScienceIcon sx={{ color: "#059669" }} />
                <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                  Principes Actifs & Molécules
                </Typography>
                <Chip label={fiche.molecules?.length || 0} size="small" sx={{ height: 20 }} />
              </Stack>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setDialogAjoutMol(true)}
                sx={{ textTransform: "none", fontSize: "0.78rem" }}
              >
                Ajouter une molécule
              </Button>
            </Stack>

            {fiche.molecules && fiche.molecules.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#f8fafc" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "700" }}>MOLÉCULE</TableCell>
                      <TableCell sx={{ fontWeight: "700" }}>FORMULE CHIMIQUE</TableCell>
                      <TableCell sx={{ fontWeight: "700" }}>TYPE</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "700" }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fiche.molecules.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="600">
                            {m.nom || m.id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            :{m.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <code>{m.formuleChimique || "—"}</code>
                        </TableCell>
                        <TableCell>
                          <Chip label="Principe Actif" size="small" sx={{ bgcolor: "#eff6ff", color: "#1e40af" }} />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleRetirerMolecule(m.id)}>
                            <DeleteOutlineIcon fontSize="small" sx={{ color: "#ef4444" }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Aucune molécule associée pour l'instant.
              </Typography>
            )}
          </Paper>

          {/* Excipients */}
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CategoryIcon sx={{ color: "#475569" }} />
                <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                  Excipients
                </Typography>
                <Chip label={fiche.excipients?.length || 0} size="small" sx={{ height: 20 }} />
              </Stack>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setDialogAjoutExc(true)}
                sx={{ textTransform: "none", fontSize: "0.78rem" }}
              >
                Ajouter un excipient
              </Button>
            </Stack>

            {fiche.excipients && fiche.excipients.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: "#f8fafc" }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "700" }}>EXCIPIENT</TableCell>
                      <TableCell sx={{ fontWeight: "700" }}>EFFET NOTOIRE</TableCell>
                      <TableCell align="right" sx={{ fontWeight: "700" }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fiche.excipients.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="600">
                            {ex.nom || ex.id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            :{ex.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {ex.effetNotoire ? (
                            <Chip label={ex.effetNotoire} size="small" sx={{ bgcolor: "#fffbeb", color: "#b45309" }} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Neutre (aucun effet notoire)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleRetirerExcipient(ex.id)}>
                            <DeleteOutlineIcon fontSize="small" sx={{ color: "#ef4444" }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Aucun excipient renseigné.
              </Typography>
            )}
          </Paper>

          {/* Patients prenant ce médicament (Croisement Domaine C) */}
          <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <PeopleAltOutlinedIcon sx={{ color: "#2563eb" }} />
              <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                Patients Traités (Croisement Domaine Patients)
              </Typography>
              <Chip label={fiche.patients?.length || 0} size="small" sx={{ height: 20 }} />
            </Stack>
            {fiche.patients && fiche.patients.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {fiche.patients.map((p) => (
                  <Chip
                    key={p.id}
                    component={Link}
                    to={`/patients/${p.id}`}
                    clickable
                    label={`${p.prenom || ""} ${p.nom || ""} (${p.age || "?"} ans)`.trim()}
                    sx={{ my: 0.5, bgcolor: "#eff6ff", color: "#1e40af" }}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucun patient n'a ce médicament d'inscrit dans son traitement actuellement.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Colonne Droite : Forme, Voie, Classe Thérapeutique, Contre-indications */}
        <Grid item xs={12} md={5}>
          {/* Classification & Galénique */}
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
            <Typography variant="subtitle1" fontWeight="700" color="#0f172a" sx={{ mb: 2 }}>
              Classification Pharmaceutique
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  FORME PHARMACEUTIQUE (GALÉNIQUE)
                </Typography>
                <Typography variant="body1" fontWeight="600" color="#0f172a">
                  {fiche.forme?.libelle || "Non renseignée"}
                </Typography>
                {fiche.forme && (
                  <Typography variant="caption" color="text.secondary">
                    :{fiche.forme.id}
                  </Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  VOIE D'ADMINISTRATION
                </Typography>
                <Typography variant="body1" fontWeight="600" color="#0f172a">
                  {fiche.voie?.libelle || "Non renseignée"}
                </Typography>
                {fiche.voie && (
                  <Typography variant="caption" color="text.secondary">
                    :{fiche.voie.id}
                  </Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  CLASSE THÉRAPEUTIQUE
                </Typography>
                <Typography variant="body1" fontWeight="600" color="#0f172a">
                  {fiche.classe?.libelle || "Non renseignée"}
                </Typography>
                {fiche.classe?.parent && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    ↳ Sous-classe de : <strong>{fiche.classe.parent}</strong>
                  </Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight="600">
                  LABORATOIRE FABRICANT
                </Typography>
                <Typography variant="body1" fontWeight="600" color="#0f172a">
                  {fiche.laboratoire?.nom || "Non renseigné"}
                </Typography>
                {fiche.laboratoire && (
                  <Typography variant="caption" color="text.secondary">
                    Pays : {fiche.laboratoire.pays || "Non précisé"}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>

          {/* Contre-indications */}
          <Paper sx={{ p: 2.5, borderRadius: 2, border: "1px solid #fee2e2", bgcolor: "#fffafb" }} elevation={0}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <WarningAmberIcon sx={{ color: "#dc2626" }} />
              <Typography variant="subtitle1" fontWeight="700" color="#b91c1c">
                Contre-Indications Rattachées
              </Typography>
            </Stack>

            {fiche.contreIndications && fiche.contreIndications.length > 0 ? (
              <Stack spacing={1.5}>
                {fiche.contreIndications.map((ci) => (
                  <Paper key={ci.id} sx={{ p: 1.5, bgcolor: "#fff", border: "1px solid #fecaca" }} elevation={0}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="700" color="#991b1b">
                        {ci.libelle || ci.id}
                      </Typography>
                      {ci.estAbsolue ? (
                        <Chip label="Absolue" size="small" color="error" sx={{ height: 20, fontSize: "0.68rem" }} />
                      ) : (
                        <Chip label="Relative" size="small" color="warning" sx={{ height: 20, fontSize: "0.68rem" }} />
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Aucune contre-indication répertoriée pour ce produit.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Boîte SPARQL de la fiche */}
      <Box sx={{ mt: 3 }}>
        <SparqlBox sparql={sparql} titre="Requêtes SPARQL de Construction de la Fiche Médicament" />
      </Box>

      {/* Modal Edition Médicament */}
      <Dialog open={dialogEdition} onClose={() => setDialogEdition(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSauvegarderEdition}>
          <DialogTitle sx={{ fontWeight: "700" }}>Modifier les informations de {fiche.nomCommercial}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Nom Commercial"
                value={formEdit.nomCommercial}
                onChange={(e) => setFormEdit({ ...formEdit, nomCommercial: e.target.value })}
              />
              <TextField
                fullWidth
                type="number"
                label="Dosage (mg)"
                value={formEdit.dosageMg}
                onChange={(e) => setFormEdit({ ...formEdit, dosageMg: e.target.value })}
              />
              <TextField
                fullWidth
                label="Code AMM"
                value={formEdit.codeAMM}
                onChange={(e) => setFormEdit({ ...formEdit, codeAMM: e.target.value })}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formEdit.surOrdonnance}
                    onChange={(e) => setFormEdit({ ...formEdit, surOrdonnance: e.target.checked })}
                  />
                }
                label={formEdit.surOrdonnance ? "Soumis à ordonnance" : "Vente libre"}
              />

              <FormControl fullWidth>
                <InputLabel>Laboratoire Fabricant</InputLabel>
                <Select
                  value={formEdit.idLaboratoire}
                  label="Laboratoire Fabricant"
                  onChange={(e) => setFormEdit({ ...formEdit, idLaboratoire: e.target.value })}
                >
                  <MenuItem value="">-- Aucun --</MenuItem>
                  {refLabos.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.nom}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Forme Galénique</InputLabel>
                <Select
                  value={formEdit.idForme}
                  label="Forme Galénique"
                  onChange={(e) => setFormEdit({ ...formEdit, idForme: e.target.value })}
                >
                  <MenuItem value="">-- Aucune --</MenuItem>
                  {refFormes.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.libelle}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Voie d'administration</InputLabel>
                <Select
                  value={formEdit.idVoie}
                  label="Voie d'administration"
                  onChange={(e) => setFormEdit({ ...formEdit, idVoie: e.target.value })}
                >
                  <MenuItem value="">-- Aucune --</MenuItem>
                  {refVoies.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.libelle}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Classe Thérapeutique</InputLabel>
                <Select
                  value={formEdit.idClasse}
                  label="Classe Thérapeutique"
                  onChange={(e) => setFormEdit({ ...formEdit, idClasse: e.target.value })}
                >
                  <MenuItem value="">-- Aucune --</MenuItem>
                  {refClasses.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.libelle}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDialogEdition(false)}>Annuler</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: "#059669" }}>
              Enregistrer
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal Associer Molécule */}
      <Dialog open={dialogAjoutMol} onClose={() => setDialogAjoutMol(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>Ajouter une molécule</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Choisir une molécule</InputLabel>
            <Select value={molChoisie} label="Choisir une molécule" onChange={(e) => setMolChoisie(e.target.value)}>
              {refMolecules.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.nom} {m.formuleChimique ? `(${m.formuleChimique})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogAjoutMol(false)}>Annuler</Button>
          <Button onClick={handleAjouterMolecule} variant="contained" sx={{ bgcolor: "#059669" }}>
            Associer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Associer Excipient */}
      <Dialog open={dialogAjoutExc} onClose={() => setDialogAjoutExc(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>Ajouter un excipient</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Choisir un excipient</InputLabel>
            <Select value={excChoisi} label="Choisir un excipient" onChange={(e) => setExcChoisi(e.target.value)}>
              {refExcipients.map((ex) => (
                <MenuItem key={ex.id} value={ex.id}>
                  {ex.nom}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogAjoutExc(false)}>Annuler</Button>
          <Button onClick={handleAjouterExcipient} variant="contained" sx={{ bgcolor: "#059669" }}>
            Associer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(message)} autoHideDuration={3500} onClose={() => setMessage("")} message={message} />
    </Box>
  );
}
